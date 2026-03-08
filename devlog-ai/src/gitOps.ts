import simpleGit, { SimpleGit } from 'simple-git';

const git: SimpleGit = simpleGit();

export async function getRecentCommits(days: number = 1): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const log = await git.log({ '--since': since });
    let commitsText = '';
    log.all.forEach(commit => {
      commitsText += `Commit: ${commit.hash}\nAuthor: ${commit.author_name}\nDate: ${commit.date}\nMessage: ${commit.message}\n\n`;
    });
    return commitsText;
  } catch (error: any) {
    if (error.message && error.message.includes('does not have any commits yet')) {
      console.log("- No commits found in the current branch yet.");
    } else {
      console.error("Error fetching git logs:", error.message || error);
    }
    return "";
  }
}

export async function getUncommittedChanges(): Promise<string> {
  try {
    const status = await git.status();
    let changesText = `Modified files: ${status.modified.length}\n`;
    changesText += `Deleted files: ${status.deleted.length}\n`;
    changesText += `New/Untracked files: ${status.not_added.length}\n`;
    
    if (status.files.length > 0) {
      const diff = await git.diff();
      changesText += `\nDiff for tracked files:\n${diff}`;
    }
    return changesText;
  } catch (error) {
    console.error("Error fetching uncommitted changes:", error);
    return "";
  }
}

export async function getBranchInfo(): Promise<string> {
    try {
        const branch = await git.branch();
        return `Current Branch: ${branch.current}\n`;
    } catch (error) {
        console.error("Error fetching branch info:", error);
        return "";
    }
}
