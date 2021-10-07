export interface TestCaseRepository<T extends TestCase> {
  findAll(): Promise<T[]>;

  saveModified(testCases: T[]): Promise<T[]>;
}

export interface TestParameterDef {
  name: string;
  placeholder: string;
}

export type ParameterLine = { [param: string]: string };
export type ParameterTable = { [line: number]: ParameterLine };

export abstract class TestCase {
  abstract name(): string;

  abstract steps(): TestStep[];

  abstract parameterized(): boolean;

  abstract parameterDefs(): TestParameterDef[];

  abstract parameterTable(): ParameterTable;

  abstract source(): string;

  abstract findMetadata(name: string): TestMetadata[];

  abstract addMetadata(...metadata: TestMetadata[]): void;
}

export interface TestMetadata {
  name: string;
  value: string;
}

export interface TestStep {
  condition: string;
  expectation: string;
}

export class TestStepsBuilder {
  private steps: TestStep[] = [];

  private context: 'condition' | 'expectation' = 'condition';

  private current: TestStep = TestStepsBuilder._new();

  condition(condition: string) {
    this.context = 'condition';
    if (this.current.condition.length > 0 || this.current.expectation.length) {
      this.steps.push(this.current);
      this.current = TestStepsBuilder._new();
    }
    this.current.condition = condition;
  }

  expectation(expectation: string) {
    this.context = 'expectation';
    if (this.current.expectation.length > 0) {
      this.steps.push(this.current);
      this.current = TestStepsBuilder._new();
    }
    this.current.expectation = expectation;
  }

  and(and: string) {
    switch (this.context) {
      case 'condition':
        this.condition(and);
        break;
      case 'expectation':
        this.expectation(and);
        break;
      default:
        throw new Error(`Not handled context: ${this.context}`);
    }
  }

  private static _new(): TestStep {
    return { condition: '', expectation: '' };
  }

  result(): TestStep[] {
    if (this.current.condition.length > 0 || this.current.expectation.length) {
      this.steps.push(this.current);
      this.current = TestStepsBuilder._new();
    }
    return this.steps.concat([]);
  }
}
