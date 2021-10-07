Feature: Complex scenario

  @testcase:5
  Scenario: Complex scenario
    Given precondition
    And first step
    But except step
    * second step
    When third step
    And second step
    But second except step
    * third except step
    Then assertion
    And extra assertion
    But except assertion
    * except assertion
    When first step
    When second step
    Then assertion
    Then extra assertion
