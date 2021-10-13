import {
  ParameterTable,
  TestCase,
  TestCaseRepository,
  TestMetadata,
  TestParameterDef,
  TestStep,
  TestStepsBuilder,
} from './api';
import { Config } from '../config';
import { resolveFiles } from '../utils';
import { AstBuilder, GherkinClassicTokenMatcher, GherkinInMarkdownTokenMatcher, Parser } from '@cucumber/gherkin';
import ITokenMatcher from '@cucumber/gherkin/src/ITokenMatcher';
import { TokenType } from '@cucumber/gherkin/src/Parser';
import { GherkinDocument, IdGenerator, Scenario, Tag } from '@cucumber/messages';
import path from 'path';
import AstNode from '@cucumber/gherkin/dist/src/AstNode';
import { readFile } from 'fs';
import util from 'util';
import { pretty, walkGherkinDocument } from '@cucumber/gherkin-utils';
import { writeFile } from 'fs/promises';

const newId = IdGenerator.uuid();

enum Syntax {
  Gherkin = 'gherkin',
  Markdown = 'markdown',
}

class GherkinTestCase extends TestCase {
  modified: boolean = false;

  constructor(
    protected readonly scenario: Scenario,
    readonly document: GherkinDocument,
    protected readonly featurePath: string,
    readonly syntax: Syntax
  ) {
    super();
  }

  name(): string {
    return this.scenario.name;
  }

  steps(): TestStep[] {
    let builder = new TestStepsBuilder();

    this.scenario.steps.forEach(({ keyword, text }) => {
      switch (keyword.trim()) {
        case 'Given':
        case 'When':
          builder.condition(text);
          break;
        case 'Then':
          builder.expectation(text);
          break;
        case 'And':
        case 'But':
        case '*':
          builder.and(text);
          break;
        default:
          throw new Error(`Unknown step keyword: ${keyword}`);
      }
    });

    return builder.result();
  }

  parameterized(): boolean {
    // TODO: so far, support only first example
    return this.scenario.examples.length > 0 && this.scenario.examples[0].tableHeader!.cells.length > 0;
  }

  parameterDefs(): TestParameterDef[] {
    return (
      this.scenario.examples[0].tableHeader!.cells.map(cell => {
        return {
          name: cell.value,
          placeholder: `<${cell.value}>`,
        };
      }) ?? []
    );
  }

  parameterTable(): ParameterTable {
    let table: ParameterTable = {};

    let example = this.scenario.examples[0];

    let headers = example.tableHeader!.cells;

    for (let line = 0; line < example.tableBody.length; line++) {
      let tableRow = example.tableBody[line];

      for (let column = 0; column < headers.length; column++) {
        let header: string = headers[column].value;
        if (!table[line]) {
          table[line] = {};
        }
        table[line][header] = tableRow.cells[column].value;
      }
    }

    return table;
  }

  source(): string {
    return this.featurePath;
  }

  findMetadata(name: string): TestMetadata[] {
    return this.scenario.tags
      .filter(tag => tag.name.startsWith(`@${name}:`))
      .map(tag => {
        return {
          name: name,
          value: tag.name.replace(`@${name}:`, ''),
        };
      });
  }

  addMetadata(...metadata: TestMetadata[]): void {
    let tags = this.scenario.tags.concat(
      metadata.map(tag => {
        this.modified = true;
        return {
          id: newId(),
          name: `@${tag.name}:${tag.value}`,
        } as Tag;
      })
    );
    let collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    tags.sort((t1, t2) => collator.compare(t1.name, t2.name));
    this.scenario.tags = tags;
  }
}

export class GherkinFeatureRepository implements TestCaseRepository<GherkinTestCase> {
  private readonly tokenMatchers: { [syntax: Syntax | string]: ITokenMatcher<TokenType> } = {};

  private readonly cwd: string;
  private readonly specs: string[];

  constructor(config: Config) {
    this.cwd = config.cwd;
    this.specs = config.specs.concat([]);

    let dialect = config.language;
    this.tokenMatchers[Syntax.Gherkin] = new GherkinClassicTokenMatcher(dialect);
    this.tokenMatchers[Syntax.Markdown] = new GherkinInMarkdownTokenMatcher(dialect);
  }

  async findAll(): Promise<GherkinTestCase[]> {
    let builder = new AstBuilder(newId);

    const readFileAsync = util.promisify(readFile);

    let result: GherkinTestCase[] = [];
    let featureFiles = resolveFiles(this.specs, this.cwd);
    for (let featureFile of featureFiles) {
      console.log(`Parsing file: ${featureFile}`);

      let { parser, syntax } = this.parser(featureFile, builder);

      let featurePath = path.resolve(this.cwd, featureFile);
      let buffer = await readFileAsync(featurePath);

      let document = parser.parse(buffer.toString('utf8'));

      console.log(`  Found feature: ${document.feature?.name}`);

      let scenarios = GherkinFeatureRepository.collectScenarios(document);

      let testCases = scenarios.map(scenario => {
        console.log(`    Found scenario: ${scenario.name}`);

        return new GherkinTestCase(scenario, document, featurePath, syntax);
      });

      result.push(...testCases);
    }

    return result;
  }

  async saveModified(testCases: GherkinTestCase[]): Promise<GherkinTestCase[]> {
    let result = [];

    for (let testCase of testCases) {
      if (testCase.modified) {
        result.push(testCase);

        let text = pretty(testCase.document, testCase.syntax);

        await writeFile(testCase.source(), text);
      }
    }

    return result;
  }

  private parser(featureFile: string, builder: AstBuilder): { parser: Parser<AstNode>; syntax: Syntax } {
    let syntax;
    let tokenMatcher;
    if (featureFile.endsWith('.feature')) {
      syntax = Syntax.Gherkin;
      tokenMatcher = this.tokenMatchers[syntax];
    } else if (featureFile.endsWith('.feature.md')) {
      syntax = Syntax.Markdown;
      tokenMatcher = this.tokenMatchers[syntax];
    } else {
      throw new Error(`Not supported feature file format ${featureFile}`);
    }
    return {
      parser: new Parser(builder, tokenMatcher),
      syntax: syntax,
    };
  }

  private static collectScenarios(document: GherkinDocument) {
    return walkGherkinDocument(document, [] as Scenario[], {
      scenario: (scenario, acc) => acc.concat([scenario]),
    });
  }
}
