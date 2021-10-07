export interface VcsClient {
  syncToRemote(updatedFeatureFiles: string[]): void;
}
