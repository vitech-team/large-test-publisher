import { Config, RuntimeConfig } from './config';
import dotenv from 'dotenv';
import { TestCase } from './testcase/api';
import { PublishOutcome, SyncOutcome, TmsClient } from './tms/api';
import { TestReport } from './report/api';
import path from "path";

dotenv.config();

class SyncSummary {
  total: number = 0;
  created: number = 0;
  updated: number = 0;
  failed: number = 0;

  static of(outcome: SyncOutcome): SyncSummary {
    return {
      total: 1,
      created: outcome == SyncOutcome.Created ? 1 : 0,
      updated: outcome == SyncOutcome.Updated ? 1 : 0,
      failed: outcome == SyncOutcome.Failed ? 1 : 0,
    };
  }

  static mergeSyncSummary(l: SyncSummary, r: SyncSummary): SyncSummary {
    return {
      total: l.total + r.total,
      created: l.created + r.created,
      updated: l.updated + r.updated,
      failed: l.failed + r.failed,
    };
  }
}

class PublishSummary {
  total: number = 0;
  successful: number = 0;
  failed: number = 0;

  static of(outcome: PublishOutcome): PublishSummary {
    return {
      total: 1,
      successful: outcome == PublishOutcome.Successful ? 1 : 0,
      failed: outcome == PublishOutcome.Failed ? 1 : 0,
    };
  }

  static mergePublishSummary(l: PublishSummary, r: PublishSummary): PublishSummary {
    return {
      total: l.total + r.total,
      successful: l.successful + r.successful,
      failed: l.failed + r.failed,
    };
  }
}

async function synchronizeTestCases(testCases: TestCase[], tmsClient: TmsClient<any, any>): Promise<TestCase[]> {
  let syncTestCases = [];
  let syncSummaries = [];
  for (let testCase of testCases) {
    let syncResult = await tmsClient.syncTestCase(testCase);
    syncSummaries.push(SyncSummary.of(syncResult.outcome));

    if (syncResult.outcome != SyncOutcome.Failed) {
      syncTestCases.push(syncResult.testCase);
    }
  }

  let refreshSummary = syncSummaries.reduce(SyncSummary.mergeSyncSummary, new SyncSummary());
  console.log('\n==============================================================\n');
  console.log('Test Cases sync-up summary:');
  console.log(`  = Total test cases: ${refreshSummary.total}`);
  console.log(`  + Created test cases: ${refreshSummary.created}`);
  console.log(`  * Updated test cases: ${refreshSummary.updated}`);
  console.log(`  - Failed sync-ups: ${refreshSummary.failed}`);
  console.log('\n==============================================================\n');

  return syncTestCases;
}

async function publishTestReports(testReports: TestReport[], tmsClient: TmsClient<any, any>) {
  let publishResults = await tmsClient.publishTestReports(testReports);
  let publishSummaries = publishResults.map(({ outcome }) => PublishSummary.of(outcome));

  let publishSummary = publishSummaries.reduce(PublishSummary.mergePublishSummary, new PublishSummary());
  console.log('\n==============================================================\n');
  console.log('Test Report publication summary:');
  console.log(`  = Total test results: ${publishSummary.total}`);
  console.log(`  + Successfully published: ${publishSummary.successful}`);
  console.log(`  - Failed to publish: ${publishSummary.failed}`);
  console.log('\n==============================================================\n');
}

export default async function main(): Promise<void> {
  let config: Config = require(path.resolve(process.cwd(), 'tms.config.js'));

  let rt = new RuntimeConfig(config);

  let testCaseRepository = rt.getTestCaseRepository();

  let tmsClient = rt.getTmsClient();

  let syncTestCases;
  {
    let testCases = await testCaseRepository.findAll();
    syncTestCases = await synchronizeTestCases(testCases, tmsClient);
  }

  {
    let vcsClient = rt.getVcsClient();
    let modifiedFiles = (await testCaseRepository.saveModified(syncTestCases)).map(testCase => testCase.source());
    vcsClient.syncToRemote(modifiedFiles);
  }

  let testReportRepository = rt.getTestReportRepository();
  let testReports = await testReportRepository.findAll(syncTestCases);
  await publishTestReports(testReports, tmsClient);

  console.log("That's it!");
}
