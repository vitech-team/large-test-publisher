import { defineParameterType, Given, Then, When } from '@cucumber/cucumber';

defineParameterType({
  regexp: /[A-Za-z0-9-]+/,
  transformer: (v: string) => v,
  name: 'param',
});

Given('precondition', () => {});
Given('precondition with {param} and {param}', (param1: string, param2: string) => {});

When('first step', () => {});
When('step with {param}', (param: string) => {});
When('second step', () => {});
When('except step', () => {});

When('third step', () => {});
When('second except step', () => {});
When('third except step', () => {});

Then('extra assertion', () => {});
Then('except assertion', () => {});
Then('assertion', () => {});
