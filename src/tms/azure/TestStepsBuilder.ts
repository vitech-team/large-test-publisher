import { ParameterLine, TestCase } from '../../testcase/api';
import * as js2xmlparser from 'js2xmlparser';

export class TestStepsBuilder {
  constructor(private readonly testCase: TestCase) {}

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
  steps(): string {
    let parameterize: (s: string) => string = (s: string) => s;
    if (this.testCase.parameterized()) {
      let defs = this.testCase.parameterDefs();
      parameterize = (s: string): string => {
        for (let def of defs) {
          s = s.replace(def.placeholder, `@${def.name}`);
        }
        return s;
      };
    }

    let steps = this.testCase.steps().map((step, idx) => {
      return {
        '@': {
          id: idx + 1,
          type: step.expectation.length > 0 ? 'ValidateStep' : 'ActionStep',
        },
        parameterizedString: [
          {
            '@': {
              isformatted: false,
            },
            '#': parameterize(step.condition),
          },
          {
            '@': {
              isformatted: false,
            },
            '#': parameterize(step.expectation),
          },
        ],
      };
    });

    return js2xmlparser.parse('steps', {
      '@': {
        id: 0,
        last: steps.length,
      },
      step: steps,
    });
  }

  /*
    <parameters>
      <param name="param1" bind="default"/>
      <param name="param2" bind="default"/>
    </parameters>
  */
  parameters() {
    let parameters = {};

    if (this.testCase.parameterized()) {
      parameters = {
        param: this.testCase.parameterDefs().map(def => {
          return {
            '@': {
              name: def.name,
              bind: 'default',
            },
          };
        }),
      };
    }

    return js2xmlparser.parse('parameters', parameters);
  }

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
  localDataSource() {
    let newDataSet = {};

    if (this.testCase.parameterized()) {
      let defs = this.testCase.parameterDefs();
      let table = this.testCase.parameterTable();
      newDataSet = {
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
          for (const def of defs) {
            result[def.name] = { '#': line[def.name] };
          }
          return result;
        }),
      };
    }

    return js2xmlparser.parse('NewDataSet', newDataSet);
  }
}
