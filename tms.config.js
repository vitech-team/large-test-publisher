const config = {
  cwd: process.cwd(),
  specs: ['features/**/*.feature'],

  language: 'en',

  reports: ['features/_report/*.json'],

  vcs: {
    enabled: false,
    message: 'Synchronized test cases',
  },

  azure_devops: {
    serviceUrl: process.env.AZURE_DEVOPS_URL || 'unknown',
    accessToken: process.env.AZURE_DEVOPS_TOKEN || 'unknown',
    projectName: process.env.AZURE_DEVOPS_PROJECT || 'unknown',
    testPlan: process.env.AZURE_DEVOPS_TEST_PLAN || 'unknown',
    areaPath: process.env.AZURE_DEVOPS_AREA_PATH || 'unknown',
    buildId: process.env.AZURE_DEVOPS_BUILD_ID || 'unknown',
  },
};

module.exports = config;
