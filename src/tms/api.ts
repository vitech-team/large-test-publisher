import { TestCase } from '../testcase/api';
import { TestReport } from '../report/api';

export enum SyncOutcome {
  UpToDate,
  Created,
  Updated,
  Failed,
}

export interface SyncResult {
  outcome: SyncOutcome;
  testCase: TestCase;
}

export enum PublishOutcome {
  Successful,
  Failed,
  Empty,
}

export interface PublishResult {
  outcome: PublishOutcome;
  testReport: TestReport;
}

export abstract class TmsClient<ID, CONTEXT> {
  async syncTestCase(testCase: TestCase): Promise<SyncResult> {
    console.log(`Synchronizing test case: '${testCase.name()}'`);

    let outcome;
    try {
      let testCaseId = this.findTestCaseId(testCase);

      if (testCaseId) {
        let updated = await this.updateTestCase(testCaseId, testCase);
        if (updated) {
          outcome = SyncOutcome.Updated;
          console.log(`  * Work item #${testCaseId} has been updated for '${testCase.name()}' test case`);
        } else {
          outcome = SyncOutcome.UpToDate;
          console.log(`  = Work item #${testCaseId} is up-to-date with '${testCase.name()}' test case`);
        }
      } else {
        let testCaseId = await this.createTestCase(testCase);
        this.saveTestCaseId(testCaseId, testCase);
        outcome = SyncOutcome.Created;
        console.log(`  + Work item #${testCaseId} has been created for '${testCase.name()}' test case`);
      }
    } catch (err) {
      outcome = SyncOutcome.Failed;
      console.log(`Failed to synchronize test case '${testCase.name()}'`);
      console.log(err);
    }

    return { outcome, testCase };
  }

  async publishTestReports(testReports: TestReport[]): Promise<PublishResult[]> {
    let context = await this.setupRunContext();

    let result = [];
    for (let testReport of testReports) {
      let outcome: PublishOutcome;
      try {
        await this.addTestReportToRunContext(testReport, context);
        outcome = PublishOutcome.Successful;
      } catch (err) {
        outcome = PublishOutcome.Failed;
        console.log(`Failed to publish test report for '${testReport.testCase.name()}'`);
        console.log(err);
      }
      result.push({ outcome, testReport });
    }

    await this.finalizeRunContext(context);

    return result;
  }

  protected abstract findTestCaseId(testCase: TestCase): ID | undefined;

  protected abstract saveTestCaseId(testCaseId: ID, testCase: TestCase): void;

  protected abstract createTestCase(testCase: TestCase): Promise<ID>;

  protected abstract updateTestCase(testCaseId: ID, testCase: TestCase): Promise<boolean>;

  protected abstract setupRunContext(): Promise<CONTEXT>;

  protected abstract addTestReportToRunContext(testReport: TestReport, context: CONTEXT): Promise<boolean>;

  protected abstract finalizeRunContext(context: CONTEXT): Promise<void>;
}
