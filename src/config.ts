import { TmsClient } from './tms/api';
import { TestReport, TestReportRepository } from './report/api';
import { VcsClient } from './vcs/api';
import { TestCase, TestCaseRepository } from './testcase/api';
import { GherkinFeatureRepository } from './testcase/GherkinFeatureRepository';
import { SerenityBDDReportRepository } from './report/SerenityBDDReportRepository';
import * as azdev from 'azure-devops-node-api';
import { AzureDevopsClient } from './tms/AzureDevopsClient';
import { SimpleGitClient } from './vcs/SimpleGitClient';

export interface Config {
  cwd: string;
  specs: string[];

  language: string;

  reports: string[];
}

export class RuntimeConfig {
  constructor(private config: Config) {}

  getTestCaseRepository(): TestCaseRepository<TestCase> {
    return new GherkinFeatureRepository(this.config);
  }

  getTestReportRepository(): TestReportRepository<TestReport> {
    return new SerenityBDDReportRepository(this.config.reports, this.config.cwd);
  }

  getTmsClient(): TmsClient<any> {
    const azureApi = new azdev.WebApi(
      process.env.AZURE_DEVOPS_URL || 'unknown',
      azdev.getPersonalAccessTokenHandler(process.env.AZURE_DEVOPS_TOKEN || 'unknown')
    );
    let project = process.env.AZURE_DEVOPS_PROJECT || 'unknown';

    return new AzureDevopsClient(azureApi, project);
  }

  getVcsClient(): VcsClient {
    return new SimpleGitClient();
  }
}

const config: Config = {
  cwd: process.cwd(),
  specs: ['features/**/*.feature'],

  language: 'en',

  reports: ['target/site/serenity/*.json'],
};

export default config;
