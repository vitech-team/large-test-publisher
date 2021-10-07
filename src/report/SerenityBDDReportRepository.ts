import { SerenityBDDReport } from '@serenity-js/serenity-bdd/lib/stage/crew/serenity-bdd-reporter/SerenityBDDJsonSchema';
import { readFile } from 'fs';
import path from 'path';
import { TestReport, TestReportRepository, TestStepOutcome } from './api';
import { TestCase } from '../testcase/api';
import util from 'util';
import { resolveFiles } from '../utils';

class SerenityBDDReportResult implements TestReport {
  readonly testCase: TestCase;

  constructor(testCase: TestCase, private report: SerenityBDDReport) {
    this.testCase = testCase;
  }

  testStepOutcomes(): TestStepOutcome[] {
    return [];
  }
}

export class SerenityBDDReportRepository extends TestReportRepository<SerenityBDDReportResult> {
  private _reports?: SerenityBDDReport[];

  constructor(private reportFiles: string[], private cwd: string) {
    super();
  }

  async doFind(testCase: TestCase): Promise<SerenityBDDReportResult> {
    // TODO: use some kind if ID to find appropriate report
    let reports = (await this.reports()).filter(report => report.name === testCase.name());
    if (reports.length === 1) {
      let report = reports[0];
      console.log(`Found test report '${report.id}' for test case '${testCase.name()}'`);
      return new SerenityBDDReportResult(testCase, report);
    } else if (reports.length > 1) {
      throw new Error(
        `Found ${reports.length} test reports for test case '${testCase.name()}', ids: '${reports
          .map(r => r.id)
          .join("', '")}'`
      );
    } else {
      throw new Error(`Unable to find report result for test case '${testCase.name()}'`);
    }
  }

  private async reports(): Promise<SerenityBDDReport[]> {
    const readFileAsync = util.promisify(readFile);

    if (this._reports === undefined) {
      this._reports = [];
      let reportFiles = resolveFiles(this.reportFiles, this.cwd);

      for (let reportFile of reportFiles) {
        let report = (await readFileAsync(path.resolve(this.cwd, reportFile))).toString('utf8');
        this._reports.push(JSON.parse(report) as SerenityBDDReport);
      }
    }

    return this._reports;
  }
}
