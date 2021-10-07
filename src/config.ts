import { TmsClient } from './tms/api';
import { TestReport, TestReportRepository } from './report/api';
import { VcsClient } from './vcs/api';
import { TestCase, TestCaseRepository } from './testcase/api';
import { GherkinFeatureRepository } from './testcase/GherkinFeatureRepository';
import { SerenityBDDReportRepository } from './report/SerenityBDDReportRepository';
import { AzureDevopsClient } from './tms/AzureDevopsClient';
import { SimpleGitClient } from './vcs/SimpleGitClient';

export interface AzureDevopsOpts {
  serviceUrl: string;
  accessToken: string;
  projectName: string;
  testPlan: string;
  buildId: string;
}

export interface VcsOpts {
  message: string;
}

export interface Config {
  cwd: string;
  specs: string[];

  language: string;

  reports: string[];

  vcs: VcsOpts

  azure_devops?: AzureDevopsOpts;
}

export class RuntimeConfig {
  constructor(private config: Config) {}

  getTestCaseRepository(): TestCaseRepository<TestCase> {
    return new GherkinFeatureRepository(this.config);
  }

  getTestReportRepository(): TestReportRepository<TestReport> {
    return new SerenityBDDReportRepository(this.config.reports, this.config.cwd);
  }

  getTmsClient(): TmsClient<any, any> {
    this.config.azure_devops;
    if (this.config.azure_devops) {
      return new AzureDevopsClient(this.config.azure_devops);
    }

    throw new Error('Unable to determine Test Management System configuration');
  }

  getVcsClient(): VcsClient {
    return new SimpleGitClient(this.config.vcs);
  }
}
