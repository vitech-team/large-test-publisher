import { VcsClient } from './api';
import { VcsOpts } from '../config';
import simpleGit, { SimpleGit } from 'simple-git/promise';

export class SimpleGitClient implements VcsClient {
  private readonly git: SimpleGit;

  constructor(private readonly vcsOpts: VcsOpts) {
    this.git = simpleGit();
  }

  async syncToRemote(files: string[]): Promise<void> {
    if (!this.vcsOpts.enabled) {
      console.log(`Skipping VCS sync since it's disabled`);
      return;
    }

    if (files.length > 0) {
      await this.git.add(files);
      await this.git.commit(this.vcsOpts.message);
      await this.git.push();
      console.log(`Pushed spec files to remote: \n  ${files.join('\n  ')}`);
    }
  }
}
