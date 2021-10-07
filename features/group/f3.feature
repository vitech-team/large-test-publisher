Feature: Few parameterised scenarios

  @testcase:3
  Scenario Template: Scenario template
    Given precondition with <p1> and <p2>
    When first step
    And second step
    Then assertion

    Examples:
      | p1     | p2     |
      | p1-ex1 | p2-ex1 |
      | p1-ex2 | p2-ex1 |

  @testcase:4
  Scenario Outline: Scenario outline
    Given precondition
    When step with <param>
    And second step
    Then assertion

    Examples:
      | param  |
      | value1 |
      | value2 |
