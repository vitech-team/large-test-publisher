import { Config } from './src/config';

const tmsConfig: Config = {
  cwd: process.cwd(),
  specs: ['features/**/*.feature'],

  language: 'en',

  reports: ['features/_report/*.json'],

  azure_devops: {
    serviceUrl: process.env.AZURE_DEVOPS_URL || 'unknown',
    accessToken: process.env.AZURE_DEVOPS_TOKEN || 'unknown',
    projectName: process.env.AZURE_DEVOPS_PROJECT || 'unknown',
    testPlan: process.env.AZURE_DEVOPS_TEST_PLAN || 'unknown',
    buildId: process.env.AZURE_DEVOPS_BUILD_ID || 'unknown',
  },
};

export default tmsConfig;