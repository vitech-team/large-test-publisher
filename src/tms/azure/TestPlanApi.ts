import { ClientApiBase } from 'azure-devops-node-api/ClientApiBases';
import {
  ReleaseEnvironmentDefinitionReference,
  ShallowReference,
  TestOutcomeSettings,
  TypeInfo,
} from 'azure-devops-node-api/interfaces/TestInterfaces';
import { WebApi } from 'azure-devops-node-api';
import { ClientVersioningData } from 'azure-devops-node-api/VsoClient';
import { IRequestOptions, IRestResponse } from 'typed-rest-client';
import { IdentityRef } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { TeamProjectReference } from 'azure-devops-node-api/interfaces/CoreInterfaces';

export type TestSuiteType = 'none' | 'dynamicTestSuite' | 'requirementTestSuite' | 'staticTestSuite';

export interface TestSuiteCreateParams {
  defaultConfigurations?: ShallowReference[];
  defaultTesters?: IdentityRef[];
  inheritDefaultConfigurations?: boolean;
  name?: string;
  parentSuite: ShallowReference;
  queryString?: string;
  requirementId?: number;
  suiteType: TestSuiteType;
}

export interface TestSuite {
  _links: any;
  children: TestSuite[];
  defaultConfigurations: ShallowReference[];
  defaultTesters: IdentityRef[];
  hasChildren: boolean;
  id: number;
  inheritDefaultConfigurations: boolean;
  lastError?: string;
  lastPopulatedDate: Date;
  lastUpdatedBy: IdentityRef;
  lastUpdatedDate: Date;
  name: string;
  parentSuite: ShallowReference;
  plan: ShallowReference;
  project: TeamProjectReference;
  queryString?: string;
  requirementId?: number;
  revision: number;
  suiteType: TestSuiteType;
}

export enum GetSuitesExpand {
  None,
  Children,
  DefaultTesters,
}

export interface CreateTestPlan {
  areaPath?: string;
  buildDefinition?: ShallowReference;
  buildId?: number;
  description?: string;
  endDate?: Date;
  iteration?: string;
  name: string;
  owner?: IdentityRef;
  releaseEnvironmentDefinition?: ReleaseEnvironmentDefinitionReference;
  startDate?: Date;
  testOutcomeSettings?: TestOutcomeSettings;
}

export interface TestPlan {
  _links: any;
  areaPath?: string;
  buildDefinition?: ShallowReference;
  buildId?: number;
  description?: string;
  endDate?: Date;
  id: number;
  iteration: string;
  name: string;
  owner?: IdentityRef;
  previousBuildId?: number;
  project?: TeamProjectReference;
  releaseEnvironmentDefinition?: ReleaseEnvironmentDefinitionReference;
  revision?: number;
  rootSuite: ShallowReference;
  startDate?: Date;
  state?: string;
  testOutcomeSettings?: TestOutcomeSettings;
  updatedBy?: IdentityRef;
  updatedDate?: Date;
}

export interface ITestPlanApi extends ClientApiBase {
  createTestPlan(testPlan: CreateTestPlan, project: string): Promise<TestPlan>;
  getTestPlans(
    project: string,
    continuationToken?: string
  ): Promise<{
    testPlans: TestPlan[];
    continuationToken?: string;
  }>;

  createTestSuite(testSuite: TestSuiteCreateParams, project: string, planId: number): Promise<TestSuite>;
  getTestSuiteById(project: string, planId: number, suiteId: number, expand?: GetSuitesExpand): Promise<TestSuite>;
  getTestSuites(project: string, planId: number): Promise<TestSuite[]>;
}

export class TestPlanApi extends ClientApiBase implements ITestPlanApi {
  constructor(webApi: WebApi) {
    super(webApi.serverUrl, [webApi.authHandler], 'node-Test-Plan-api', webApi.options);
  }

  /*
    {
      "id": "e4c27205-9d23-4c98-b958-d798bc3f9cd4",
      "name": "testplan",
      "locationUrl": "https://dev.azure.com/TelehealthSolution/"
    }
   */
  public static readonly RESOURCE_AREA_ID = 'e4c27205-9d23-4c98-b958-d798bc3f9cd4';

  async createTestPlan(testPlan: CreateTestPlan, project: string): Promise<TestPlan> {
    return new Promise<TestPlan>(async (resolve, reject) => {
      let routeValues: any = {
        project: project,
      };

      try {
        /*
          {
            "id": "0e292477-a0c2-47f3-a9b6-34f153d627f4",
            "area": "testplan",
            "resourceName": "Plans",
            "routeTemplate": "{project}/_apis/{area}/{resource}/{planId}",
            "resourceVersion": 1,
            "minVersion": "5.0",
            "maxVersion": "6.1",
            "releasedVersion": "0.0"
          }
         */
        let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
          '6.1-preview.1',
          'TestPlan',
          '0e292477-a0c2-47f3-a9b6-34f153d627f4',
          routeValues
        );

        let url: string = verData.requestUrl!;
        let options: IRequestOptions = this.createRequestOptions('application/json', verData.apiVersion);

        let res: IRestResponse<TestPlan>;
        res = await this.rest.create<TestPlan>(url, testPlan, options);

        let ret = this.formatResponse(res.result, TypeInfo.TestPlan, false);

        resolve(ret);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getTestPlans(
    project: string,
    continuationToken?: string
  ): Promise<{
    testPlans: TestPlan[];
    continuationToken?: string;
  }> {
    return new Promise<{
      testPlans: TestPlan[];
      continuationToken?: string;
    }>(async (resolve, reject) => {
      let routeValues: any = {
        project: project,
      };

      let queryValues: any = {
        continuationToken: continuationToken,
      };

      try {
        /*
          {
            "id": "0e292477-a0c2-47f3-a9b6-34f153d627f4",
            "area": "testplan",
            "resourceName": "Plans",
            "routeTemplate": "{project}/_apis/{area}/{resource}/{planId}",
            "resourceVersion": 1,
            "minVersion": "5.0",
            "maxVersion": "6.1",
            "releasedVersion": "0.0"
          }
         */
        let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
          '6.1-preview.1',
          'TestPlan',
          '0e292477-a0c2-47f3-a9b6-34f153d627f4',
          routeValues,
          queryValues
        );

        let url: string = verData.requestUrl!;
        let options: IRequestOptions = this.createRequestOptions('application/json', verData.apiVersion);

        let res: IRestResponse<TestPlan[]>;
        res = await this.rest.get<TestPlan[]>(url, options);

        let ret = this.formatResponse(res.result, null, true);

        resolve({
          testPlans: ret,
          continuationToken: (res.headers as { [k: string]: string })['x-ms-continuationtoken'],
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async createTestSuite(testSuite: TestSuiteCreateParams, project: string, planId: number): Promise<TestSuite> {
    return new Promise<TestSuite>(async (resolve, reject) => {
      let routeValues: any = {
        project: project,
        planId: planId,
      };

      try {
        /*
          {
            "id": "1046d5d3-ab61-4ca7-a65a-36118a978256",
            "area": "testplan",
            "resourceName": "Suites",
            "routeTemplate": "{project}/_apis/{area}/Plans/{planId}/{resource}/{suiteId}",
            "resourceVersion": 1,
            "minVersion": "5.0",
            "maxVersion": "6.1",
            "releasedVersion": "0.0"
          }
         */
        let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
          '6.1-preview.1',
          'TestPlan',
          '1046d5d3-ab61-4ca7-a65a-36118a978256',
          routeValues
        );

        let url: string = verData.requestUrl!;
        let options: IRequestOptions = this.createRequestOptions('application/json', verData.apiVersion);

        let res: IRestResponse<TestSuite>;
        res = await this.rest.create<TestSuite>(url, testSuite, options);

        let ret = this.formatResponse(res.result, TypeInfo.TestSuite, false);

        resolve(ret);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getTestSuiteById(
    project: string,
    planId: number,
    suiteId: number,
    expand?: GetSuitesExpand
  ): Promise<TestSuite> {
    return new Promise<TestSuite>(async (resolve, reject) => {
      let routeValues: any = {
        project: project,
        planId: planId,
        suiteId: suiteId,
      };

      let queryValues: any = {
        expand: expand,
      };

      try {
        /*
          {
            "id": "1046d5d3-ab61-4ca7-a65a-36118a978256",
            "area": "testplan",
            "resourceName": "Suites",
            "routeTemplate": "{project}/_apis/{area}/Plans/{planId}/{resource}/{suiteId}",
            "resourceVersion": 1,
            "minVersion": "5.0",
            "maxVersion": "6.1",
            "releasedVersion": "0.0"
          }
         */
        let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
          '6.1-preview.1',
          'TestPlan',
          '1046d5d3-ab61-4ca7-a65a-36118a978256',
          routeValues,
          queryValues
        );

        let url: string = verData.requestUrl!;
        let options: IRequestOptions = this.createRequestOptions('application/json', verData.apiVersion);

        let res: IRestResponse<TestSuite>;
        res = await this.rest.get<TestSuite>(url, options);

        let ret = this.formatResponse(res.result, TypeInfo.TestSuite, false);

        resolve(ret);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getTestSuites(project: string, planId: number): Promise<TestSuite[]> {
    return new Promise<TestSuite[]>(async (resolve, reject) => {
      let routeValues: any = {
        project: project,
        planId: planId,
      };

      try {
        /*
          {
            "id": "1046d5d3-ab61-4ca7-a65a-36118a978256",
            "area": "testplan",
            "resourceName": "Suites",
            "routeTemplate": "{project}/_apis/{area}/Plans/{planId}/{resource}/{suiteId}",
            "resourceVersion": 1,
            "minVersion": "5.0",
            "maxVersion": "6.1",
            "releasedVersion": "0.0"
          }
         */
        let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
          '6.1-preview.1',
          'TestPlan',
          '1046d5d3-ab61-4ca7-a65a-36118a978256',
          routeValues
        );

        let url: string = verData.requestUrl!;
        let options: IRequestOptions = this.createRequestOptions('application/json', verData.apiVersion);

        let res: IRestResponse<TestSuite[]>;
        res = await this.rest.get<TestSuite[]>(url, options);

        let ret = this.formatResponse(res.result, null, true);

        resolve(ret);
      } catch (err) {
        reject(err);
      }
    });
  }
}
