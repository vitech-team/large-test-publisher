import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import { WebApi } from 'azure-devops-node-api';
import { ITestApi } from 'azure-devops-node-api/TestApi';
import { JsonPatchDocument } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import * as js2xmlparser from 'js2xmlparser';
import { TmsClient } from './api';
import { ParameterLine, TestCase } from '../testcase/api';
import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';

enum Fields {
  System_WorkItemType = 'System.WorkItemType',

  System_Title = 'System.Title',
  Microsoft_VSTS_TCM_AutomationStatus = 'Microsoft.VSTS.TCM.AutomationStatus',
  Microsoft_VSTS_TCM_Steps = 'Microsoft.VSTS.TCM.Steps',
  Microsoft_VSTS_TCM_Parameters = 'Microsoft.VSTS.TCM.Parameters',
  Microsoft_VSTS_TCM_LocalDataSource = 'Microsoft.VSTS.TCM.LocalDataSource',

  System_AreaPath = 'System.AreaPath',
  System_TeamProject = 'System.TeamProject',
  System_IterationPath = 'System.IterationPath',
  System_State = 'System.State',
  System_Reason = 'System.Reason',
}

class Patch {
  static add(field: Fields, value: any): JsonPatchDocument {
    return this.op('add', field, value);
  }

  static replace(field: Fields, value: any): JsonPatchDocument {
    return this.op('replace', field, value);
  }

  private static op(op: string, field: Fields, value: any) {
    return {
      op,
      path: '/fields/' + field,
      value,
    };
  }
}

export class AzureDevopsClient extends TmsClient<number> {
  private readonly _testCaseIdAttr = 'testcase';
  private readonly _type = 'Test Case';

  private _workItemTrackingApi?: IWorkItemTrackingApi;

  private _testApi?: ITestApi;

  constructor(private readonly api: WebApi, private readonly project: string) {
    super();
  }

  protected getTestCaseId(testCase: TestCase): number | undefined {
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

  protected async createTestCase(testCase: TestCase): Promise<number> {
    let document = [];

    let title = testCase.name();
    document.push(Patch.add(Fields.System_Title, title));
    document.push(Patch.add(Fields.Microsoft_VSTS_TCM_AutomationStatus, 'Planned'));

    let { steps, parameters, localDataSource } = AzureDevopsClient.buildSteps(testCase);
    document.push(Patch.add(Fields.Microsoft_VSTS_TCM_Steps, steps));
    document.push(Patch.add(Fields.Microsoft_VSTS_TCM_Parameters, parameters));
    document.push(Patch.add(Fields.Microsoft_VSTS_TCM_LocalDataSource, localDataSource));

    let workItemTrackingApi = await this.workItemTrackingApi();
    let workItem = await workItemTrackingApi.createWorkItem(undefined, document, this.project, this._type);

    if (!workItem.id) {
      throw new Error('failed to create a new work item');
    }
    return workItem.id;
  }

  protected async updateTestCase(testCaseId: number, testCase: TestCase): Promise<boolean> {
    let document: JsonPatchDocument[] = [];

    let workItemTrackingApi = await this.workItemTrackingApi();
    let workItem = await workItemTrackingApi.getWorkItem(testCaseId, [
      Fields.System_WorkItemType,
      Fields.System_Title,
      Fields.Microsoft_VSTS_TCM_AutomationStatus,
      Fields.Microsoft_VSTS_TCM_Steps,
      Fields.Microsoft_VSTS_TCM_Parameters,
      Fields.Microsoft_VSTS_TCM_LocalDataSource,
    ]);

    if (workItem.fields?.[Fields.System_WorkItemType] !== this._type) {
      throw new Error(
        `Unexpected work item type '${
          workItem.fields?.[Fields.System_WorkItemType]
        }' for test case #${testCaseId}, must be '${this._type}'`
      );
    }

    let title = testCase.name();
    AzureDevopsClient.patch(workItem, document, Fields.System_Title, title);
    AzureDevopsClient.patch(workItem, document, Fields.Microsoft_VSTS_TCM_AutomationStatus, 'Planned');

    let { steps, parameters, localDataSource } = AzureDevopsClient.buildSteps(testCase);
    AzureDevopsClient.patch(workItem, document, Fields.Microsoft_VSTS_TCM_Steps, steps);
    AzureDevopsClient.patch(workItem, document, Fields.Microsoft_VSTS_TCM_Parameters, parameters);
    AzureDevopsClient.patch(workItem, document, Fields.Microsoft_VSTS_TCM_LocalDataSource, localDataSource);

    let doUpdate = document.length > 0;

    if (doUpdate) {
      await workItemTrackingApi.updateWorkItem(undefined, document, testCaseId, this.project);
    }

    return doUpdate;
  }

  private static patch(workItem: WorkItem, document: JsonPatchDocument[], field: Fields, value: string) {
    if (workItem.fields?.[field] !== value) {
      document.push(Patch.replace(field, value));
    }
  }

  private async workItemTrackingApi() {
    if (!this._workItemTrackingApi) {
      this._workItemTrackingApi = await this.api.getWorkItemTrackingApi();
    }
    return this._workItemTrackingApi;
  }

  private async testApi() {
    if (!this._testApi) {
      this._testApi = await this.api.getTestApi();
    }
    return this._testApi;
  }

  private static buildSteps(testCase: TestCase): { steps: string; parameters: string; localDataSource: string } {
    return {
      /*
      <steps id="0" last="3">
        <step id="1" type="ActionStep">
          <parameterizedString isformatted="true">given-2 @param1 and @param2</parameterizedString>
          <parameterizedString isformatted="true"></parameterizedString>
        </step>
        <step id="2" type="ActionStep">
          <parameterizedString isformatted="true">when-2</parameterizedString>
          <parameterizedString isformatted="true"></parameterizedString>
        </step>
        <step id="3" type="ValidateStep">
          <parameterizedString isformatted="true">and-2</parameterizedString>
          <parameterizedString isformatted="true">then-2</parameterizedString>
        </step>
      </steps>
      */
      steps: js2xmlparser.parse('steps', this.compileSteps(testCase)),
      /*
      <parameters>
        <param name="param1" bind="default"/>
        <param name="param2" bind="default"/>
      </parameters>
      */
      parameters: js2xmlparser.parse('parameters', this.compileParameters(testCase)),
      /*
      <NewDataSet>
        <xs:schema id='NewDataSet' xmlns:xs='http://www.w3.org/2001/XMLSchema'
                   xmlns:msdata='urn:schemas-microsoft-com:xml-msdata'>
          <xs:element name='NewDataSet' msdata:IsDataSet='true' msdata:Locale=''>
            <xs:complexType>
              <xs:choice minOccurs='0' maxOccurs='unbounded'>
                  <xs:element name='Table1'>
                    <xs:complexType>
                      <xs:sequence>
                        <xs:element name='param1' type='xs:string' minOccurs='0'/>
                        <xs:element name='param2' type='xs:string' minOccurs='0'/>
                      </xs:sequence>
                    </xs:complexType>
                  </xs:element>
                </xs:choice>
            </xs:complexType>
          </xs:element>
        </xs:schema>
        <Table1>
          <param1>p1v1</param1>
          <param2>p1v2</param2>
        </Table1>
        <Table1>
          <param1>p1v2</param1>
          <param2>p2v2</param2>
        </Table1>
      </NewDataSet>
      */
      localDataSource: js2xmlparser.parse('NewDataSet', this.compileDataSet(testCase)),
    };
  }

  private static compileSteps(testCase: TestCase) {
    let parameterize: (s: string) => string = (s: string) => s;
    if (testCase.parameterized()) {
      let defs = testCase.parameterDefs();
      parameterize = (s: string): string => {
        for (let def of defs) {
          s = s.replace(def.placeholder, `@${def.name}`);
        }
        return s;
      };
    }

    let steps = testCase.steps().map((step, idx) => {
      return {
        '@': {
          id: idx + 1,
          type: 'ValidateStep',
        },
        parameterizedString: [
          {
            '#': parameterize(step.condition),
          },
          {
            '#': parameterize(step.expectation),
          },
        ],
      };
    });
    return {
      '@': {
        id: 0,
        last: steps.length,
      },
      step: steps,
    };
  }

  private static compileParameters(testCase: TestCase) {
    let result = {};
    if (testCase.parameterized()) {
      result = {
        param: testCase.parameterDefs().map(def => {
          return {
            '@': {
              name: def.name,
              bind: 'default',
            },
          };
        }),
      };
    }
    return result;
  }

  private static compileDataSet(testCase: TestCase) {
    let result = {};
    if (testCase.parameterized()) {
      let defs = testCase.parameterDefs();
      let table = testCase.parameterTable();
      result = {
        'xs:schema': {
          '@': {
            id: 'NewDataSet',
            'xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
            'xmlns:msdata': 'urn:schemas-microsoft-com:xml-msdata',
          },
          'xs:element': {
            '@': {
              name: 'NewDataSet',
              'msdata:IsDataSet': 'true',
              'msdata:Locale': '',
            },
            'xs:complexType': {
              'xs:choice': {
                '@': {
                  minOccurs: 0,
                  maxOccurs: 'unbounded',
                },
                'xs:element': {
                  '@': {
                    name: 'Table1',
                  },
                  'xs:complexType': {
                    'xs:sequence': {
                      'xs:element': defs.map(def => {
                        return {
                          '@': {
                            name: def.name,
                            type: 'xs:string',
                            minOccurs: 0,
                          },
                        };
                      }),
                    },
                  },
                },
              },
            },
          },
        },
        Table1: Object.values(table).map((line: ParameterLine) => {
          let result: { [k: string]: any } = {};
          defs.forEach(def => {
            result[def.name] = {
              '#': line[def.name],
            };
          });
          return result;
        }),
      };
    }
    return result;
  }
}
