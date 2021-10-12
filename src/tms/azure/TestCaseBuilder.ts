import { TestCase } from '../../testcase/api';
import { JsonPatchDocument } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { TestStepsBuilder } from './TestStepsBuilder';

export class TestCaseBuilder {
  private readonly _state = 'Design';
  private readonly _automationStatus = 'Not Automated';

  static readonly _testCaseType = 'Test Case';

  private readonly userStories: WorkItem[] = [];

  constructor(private readonly testCase: TestCase) {}

  withUserStories(userStories: WorkItem[]): TestCaseBuilder {
    this.userStories.push(...userStories);
    return this;
  }

  asCreate(): JsonPatchDocument[] {
    let document: JsonPatchDocument[] = [];

    let title = this.testCase.name();
    PatchFields.patch(document, Fields.System_Title, title);
    PatchFields.patch(document, Fields.System_State, this._state);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_AutomationStatus, this._automationStatus);

    let stepsBuilder = new TestStepsBuilder(this.testCase);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_Steps, stepsBuilder.steps());
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_Parameters, stepsBuilder.parameters());
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_LocalDataSource, stepsBuilder.localDataSource());

    this.userStoryRelations(document);

    return document;
  }

  asUpdate(testItem: WorkItem): JsonPatchDocument[] {
    let document: JsonPatchDocument[] = [];

    TestCaseBuilder.validatedWorkItemType(testItem);

    PatchFields.patch(document, Fields.System_Title, this.testCase.name(), testItem);
    PatchFields.patch(document, Fields.System_State, this._state, testItem);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_AutomationStatus, this._automationStatus, testItem);

    let stepsBuilder = new TestStepsBuilder(this.testCase);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_Steps, stepsBuilder.steps(), testItem);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_Parameters, stepsBuilder.parameters(), testItem);
    PatchFields.patch(document, Fields.Microsoft_VSTS_TCM_LocalDataSource, stepsBuilder.localDataSource(), testItem);

    this.userStoryRelations(document, testItem);

    return document;
  }

  private userStoryRelations(document: JsonPatchDocument[], testItem: WorkItem | undefined = undefined) {
    for (let userStory of this.userStories) {
      if (userStory._links?.self?.href) {
        PatchRelations.tests(document, userStory._links.self.href, testItem);
      }
    }
  }

  static validatedWorkItemType(workItem: WorkItem) {
    let workItemType = workItem.fields?.[Fields.System_WorkItemType];
    if (workItemType !== TestCaseBuilder._testCaseType) {
      throw new Error(
        `Unexpected work item type '${workItemType}' for test case #${workItem.id}, must be '${TestCaseBuilder._testCaseType}'`
      );
    }
  }
}

export enum Fields {
  System_WorkItemType = 'System.WorkItemType',

  System_Title = 'System.Title',
  System_State = 'System.State',

  Microsoft_VSTS_TCM_AutomationStatus = 'Microsoft.VSTS.TCM.AutomationStatus',
  Microsoft_VSTS_TCM_Steps = 'Microsoft.VSTS.TCM.Steps',
  Microsoft_VSTS_TCM_Parameters = 'Microsoft.VSTS.TCM.Parameters',
  Microsoft_VSTS_TCM_LocalDataSource = 'Microsoft.VSTS.TCM.LocalDataSource',

  System_AreaPath = 'System.AreaPath',
  System_TeamProject = 'System.TeamProject',
  System_IterationPath = 'System.IterationPath',
  System_Reason = 'System.Reason',
}

export class PatchFields {
  static add(field: Fields, value: any): JsonPatchDocument {
    return this.op('add', field, value);
  }

  static replace(field: Fields, value: any): JsonPatchDocument {
    return this.op('replace', field, value);
  }

  static patch(document: JsonPatchDocument[], field: Fields, value: string, workItem?: WorkItem) {
    if (workItem?.fields?.[field] == undefined) {
      document.push(PatchFields.add(field, value));
    } else if (workItem.fields?.[field] !== value) {
      document.push(PatchFields.replace(field, value));
    }
  }

  private static op(op: string, field: Fields, value: any) {
    return {
      op,
      path: '/fields/' + field,
      value,
    };
  }
}

enum Relations {
  TestedBy = 'Microsoft.VSTS.Common.TestedBy-Forward',
  Tests = 'Microsoft.VSTS.Common.TestedBy-Reverse',
}

export class PatchRelations {
  static add(value: any): JsonPatchDocument {
    return this.op('add', value);
  }

  static tests(document: JsonPatchDocument[], userStoryUrl: string, testCase?: WorkItem) {
    if (
      testCase == undefined ||
      !testCase.relations?.find(rel => rel.rel === Relations.Tests && rel.url === userStoryUrl)
    ) {
      document.push(
        PatchRelations.add({
          rel: Relations.Tests,
          url: userStoryUrl,
        })
      );
    }
  }

  private static op(op: string, value: any) {
    return {
      op,
      path: '/relations/-',
      value,
    };
  }
}
