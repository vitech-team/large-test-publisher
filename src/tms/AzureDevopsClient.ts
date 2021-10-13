import { IWorkItemTrackingApi, WorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import * as azdev from 'azure-devops-node-api';
import { WebApi } from 'azure-devops-node-api';
import { ITestApi } from 'azure-devops-node-api/TestApi';
import { JsonPatchDocument } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { TmsClient } from './api';
import { TestCase } from '../testcase/api';
import { WorkItem, WorkItemExpand } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { StepOutcome, TestReport } from '../report/api';
import {
  RunCreateModel,
  RunUpdateModel,
  TestCaseResult,
  TestPoint,
} from 'azure-devops-node-api/interfaces/TestInterfaces';
import { ITestPlanApi, TestPlan, TestPlanApi, TestSuite, TestSuiteCreateParams } from './azure/TestPlanApi';
import { AzureDevopsOpts } from '../config';
import { Fields, TestCaseBuilder } from './azure/TestCaseBuilder';

type TestSuiteByUserStoryId = { [userStoryId: number]: TestSuite };

interface RunContext {
  planId: number;
  rootSuiteId: number;
  runId: number;
  suites: TestSuiteByUserStoryId;
  results: TestCaseResult[];
}

export class AzureDevopsClient extends TmsClient<number, RunContext> {
  private readonly _testCaseIdAttr = 'testcase';
  private readonly _userStoryIdAttr = 'userstory';

  private readonly _noUserStoryId = -1;

  private readonly api: WebApi;

  private _witApi?: IWorkItemTrackingApi;
  private _testApi?: ITestApi;
  private _testPlanApi?: ITestPlanApi;

  private readonly project: string;

  private readonly testPlanName: string;

  private readonly buildId: string;

  constructor({ serviceUrl, accessToken, projectName, testPlan, buildId }: AzureDevopsOpts) {
    super();
    this.api = new azdev.WebApi(serviceUrl, azdev.getPersonalAccessTokenHandler(accessToken));
    this.project = projectName;
    this.testPlanName = testPlan;
    this.buildId = buildId;
  }

  protected findTestCaseId(testCase: TestCase): number | undefined {
    let maybeId = testCase.findMetadata(this._testCaseIdAttr);

    if (maybeId.length == 0) {
      return undefined;
    } else if (maybeId.length == 1) {
      return parseInt(maybeId[0].value);
    }
    throw new Error(
      `The '${testCase.name()}' test case is linked to multiple work items: #${maybeId
        .map(value => value.value)
        .join(', #')}, which is not supported yet`
    );
  }

  protected saveTestCaseId(testCaseId: number, testCase: TestCase): void {
    testCase.addMetadata({
      name: this._testCaseIdAttr,
      value: testCaseId.toString(),
    });
  }

  protected findUserStoryIds(testCase: TestCase): number[] {
    return testCase.findMetadata(this._userStoryIdAttr).map(userStory => parseInt(userStory.value));
  }

  protected async createTestCase(testCase: TestCase): Promise<number> {
    let witApi = await this.witApi();

    let document: JsonPatchDocument[] = new TestCaseBuilder(testCase)
      .withUserStories(await this.fetchUserStories(testCase, witApi))
      .asCreate();

    let workItem = await witApi.createWorkItem(undefined, document, this.project, TestCaseBuilder._testCaseType);

    if (!workItem.id) {
      throw new Error(`Failed to create a new test case for '${testCase.name()}'`);
    }

    return workItem.id;
  }

  protected async updateTestCase(testCaseId: number, testCase: TestCase): Promise<boolean> {
    let witApi = await this.witApi();

    let document: JsonPatchDocument[] = new TestCaseBuilder(testCase)
      .withUserStories(await this.fetchUserStories(testCase, witApi))
      .asUpdate(await witApi.getWorkItem(testCaseId, undefined, undefined, WorkItemExpand.All));

    let doUpdate = document.length > 0;

    if (doUpdate) {
      await witApi.updateWorkItem(undefined, document, testCaseId, this.project);
    }

    return doUpdate;
  }

  private async fetchUserStories(testCase: TestCase, witApi: WorkItemTrackingApi): Promise<WorkItem[]> {
    let userStoryIds = this.findUserStoryIds(testCase);

    if (userStoryIds.length == 0) {
      return [];
    }

    return witApi.getWorkItems(userStoryIds, undefined, undefined, WorkItemExpand.Links);
  }

  protected async setupRunContext(): Promise<RunContext> {
    let testApi = await this.testApi();
    let testPlanApi = await this.testPlanApi();

    let testPlan = await this.getTestPlan(testPlanApi);

    let testRunModel: RunCreateModel = {
      configurationIds: [],
      plan: {
        id: testPlan.id.toString(),
      },
      build: {
        id: this.buildId,
      },
      name: 'Automation Test Run',
      automated: true,
      state: 'InProgress',
    };

    let testRun = await testApi.createTestRun(testRunModel, this.project);

    console.log(`Started test run #${testRun.id} for test plan #${testPlan.id}: '${testPlan.name}'`);

    let testSuites = await testPlanApi.getTestSuites(this.project, testPlan.id);
    let suites: TestSuiteByUserStoryId = {};
    for (let suite of testSuites) {
      suites[suite.requirementId ?? this._noUserStoryId] = suite;
    }

    return {
      planId: testPlan.id,
      rootSuiteId: parseInt(testPlan.rootSuite.id!),
      runId: testRun.id,
      suites: suites,
      results: [],
    };
  }

  private async getTestPlan(testPlanApi: ITestPlanApi): Promise<TestPlan> {
    let testPlan;
    let continuationToken: string | undefined;
    let testPlans: TestPlan[] = [];
    do {
      ({ testPlans, continuationToken } = await testPlanApi.getTestPlans(this.project, continuationToken));
      testPlan = testPlans.find(testPlan => testPlan.name == this.testPlanName);
    } while (testPlan == undefined && testPlans.length > 0 && continuationToken);

    if (testPlan == undefined) {
      testPlan = await testPlanApi.createTestPlan(
        {
          name: this.testPlanName,
        },
        this.project
      );
    }
    return testPlan;
  }

  protected async addTestReportToRunContext(testReport: TestReport, context: RunContext): Promise<boolean> {
    let workItemTrackingApi = await this.witApi();

    let testCaseId = this.findTestCaseId(testReport.testCase);
    if (testCaseId == undefined) {
      throw new Error(`Test case '${testReport.testCase.name()}' doesn't have associated work item ID`);
    }

    let testItem = await workItemTrackingApi.getWorkItem(testCaseId, [Fields.System_WorkItemType, Fields.System_Title]);
    TestCaseBuilder.validatedWorkItemType(testItem);

    let results: TestCaseResult[] = [];
    let testPoints = await this.getTestPoints(testCaseId, testReport.testCase, context);

    for (let { userStoryId, testPoint } of testPoints) {
      let testSuite = await this.getTestSuite(userStoryId, context);

      let outcome;
      let testStepOutcomes = testReport.testStepOutcomes();
      if (testStepOutcomes.length == 0) {
        // if no results found - fail (so far)
        outcome = 'Failed';
      } else {
        outcome = testStepOutcomes.every(testOutcome => testOutcome.outcome == StepOutcome.Success)
          ? 'Passed'
          : 'Failed';
      }
      results.push({
        testCaseTitle: testItem.fields?.[Fields.System_Title],
        testCaseRevision: testItem.rev,

        testCase: {
          id: testCaseId.toString(),
        },
        testPoint: {
          id: testPoint.id.toString(),
        },
        testSuite: {
          id: testSuite.id.toString(),
        },
        testPlan: {
          id: context.planId.toString(),
        },

        outcome: outcome,
        // TODO: add detailed results
        // subResults: [],
        // stackTrace: '',
        // errorMessage: '',
        // iterationDetails: [],
        state: 'Completed',
      });
    }

    context.results.push(...results);

    console.log(`Prepared ${results.length} test result(s) for test case #${testCaseId}`);

    return Promise.resolve(true);
  }

  private async getTestPoints(
    testCaseId: number,
    testCase: TestCase,
    context: RunContext
  ): Promise<
    {
      userStoryId: number;
      testPoint: TestPoint;
    }[]
  > {
    let testApi = await this.testApi();

    let points = [];
    let userStoryIds = this.findUserStoryIds(testCase);
    for (let userStoryId of userStoryIds) {
      let testSuite = await this.getTestSuite(userStoryId, context);

      let testPoint = await this.getTestPoint(testCaseId, testSuite.id, context);

      points.push({ userStoryId, testPoint });

      // remove from the root suite if at least one user story is assigned
      await testApi.removeTestCasesFromSuiteUrl(
        this.project,
        context.planId,
        context.rootSuiteId,
        testCaseId.toString()
      );
    }

    if (points.length == 0) {
      // if test case is not assigned to any user story - add it to the root suite
      let testPoint;
      try {
        testPoint = await this.getTestPoint(testCaseId, context.rootSuiteId, context);
      } catch (err) {
        // maybe test case is not in the suite yet - just adding it and trying again
        await testApi.addTestCasesToSuite(this.project, context.planId, context.rootSuiteId, testCaseId.toString());

        testPoint = await this.getTestPoint(testCaseId, context.rootSuiteId, context);
      }

      points.push({ userStoryId: this._noUserStoryId, testPoint });
    }

    return points;
  }

  private async getTestPoint(testCaseId: number, suiteId: number, context: RunContext): Promise<TestPoint> {
    let testApi = await this.testApi();

    let [testPoint] = await testApi.getPoints(
      this.project,
      context.planId,
      suiteId,
      undefined,
      undefined,
      testCaseId.toString()
    );

    if (testPoint?.id == undefined) {
      throw new Error(`Test point doesn't exist for test case #${testCaseId}`);
    }

    return testPoint;
  }

  private async getTestSuite(userStoryId: number, context: RunContext) {
    let testPlanApi = await this.testPlanApi();

    let testSuite = context.suites[userStoryId];
    if (testSuite == undefined) {
      let testSuiteModel = {
        parentSuite: {
          id: context.rootSuiteId.toString(),
        },
        requirementId: userStoryId,
        suiteType: 'requirementTestSuite',
      } as TestSuiteCreateParams;
      testSuite = await testPlanApi.createTestSuite(testSuiteModel, this.project, context.planId);
      context.suites[userStoryId] = testSuite;
    }

    return testSuite;
  }

  protected async finalizeRunContext(context: RunContext): Promise<void> {
    let testApi = await this.testApi();

    let testCaseResults = await testApi.addTestResultsToTestRun(context.results, this.project, context.runId);

    console.log(`Published ${testCaseResults.length} test case results for test run #${context.runId}`);

    let testRunModel: RunUpdateModel = {
      state: 'Completed',
    };
    let testRun = await testApi.updateTestRun(testRunModel, this.project, context.runId);

    console.log(`Closed test run #${testRun.id} with ${testRun.state} state`);
  }

  private async witApi(): Promise<IWorkItemTrackingApi> {
    if (!this._witApi) {
      this._witApi = await this.api.getWorkItemTrackingApi();
    }
    return this._witApi;
  }

  private async testApi(): Promise<ITestApi> {
    if (!this._testApi) {
      this._testApi = await this.api.getTestApi();
    }
    return this._testApi;
  }

  private async testPlanApi(): Promise<ITestPlanApi> {
    if (!this._testPlanApi) {
      this._testPlanApi = new TestPlanApi(this.api);
    }
    return this._testPlanApi;
  }
}
