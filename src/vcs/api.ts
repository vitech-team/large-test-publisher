export interface VcsClient {
  syncToRemote(files: string[]): Promise<void>;
}
