import { VcsClient } from './api';

export class SimpleGitClient implements VcsClient {
  syncToRemote(updatedSpecFiles: string[]): void {
    if (updatedSpecFiles) {
      console.log(`Pushing spec files to remote: \n  ${updatedSpecFiles.join('\n  ')}`);
    }
  }
}
