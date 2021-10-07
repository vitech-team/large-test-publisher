import { TestCase, TestStep } from '../testcase/api';

export interface TestReport {
  readonly testCase: TestCase;

  testStepOutcomes(): TestStepOutcome[];
}

export interface TestStepOutcome extends TestStep {
  outcome: StepOutcome;
}

export enum StepOutcome {
  Success,
  Failure,
}

class MissingTestReport implements TestReport {
  readonly testCase: TestCase;

  constructor(testCase: TestCase) {
    this.testCase = testCase;
  }

  testStepOutcomes(): TestStepOutcome[] {
    return [];
  }
}

export abstract class TestReportRepository<T extends TestReport> {
  async findAll(testCases: TestCase[]): Promise<TestReport[]> {
    let result = [];
    for (let testCase of testCases) {
      try {
        result.push(await this.doFind(testCase));
      } catch (err) {
        result.push(new MissingTestReport(testCase));
        console.log(err);
      }
    }
    return result;
  }

  protected abstract doFind(testCase: TestCase): Promise<TestReport>;
}
