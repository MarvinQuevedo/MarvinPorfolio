import simpleGit, { SimpleGit } from 'simple-git';

const getGitInstance = (repoPath?: string): SimpleGit => {
    return repoPath ? simpleGit(repoPath) : simpleGit();
};

export async function getRecentCommits(options: { days?: number, date?: string, repoPath?: string } = {}): Promise<string> {
  const git = getGitInstance(options.repoPath);
  
  let since = '';
  let until = '';
  
  if (options.date) {
    // If date is provided (e.g. YYYY-MM-DD), set since to start of day and until to end of day
    const targetDate = new Date(options.date);
    targetDate.setHours(0, 0, 0, 0);
    since = targetDate.toISOString();
    
    const endDate = new Date(options.date);
    endDate.setHours(23, 59, 59, 999);
    until = endDate.toISOString();
  } else {
    const days = options.days || 1;
    since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    const logOptions: any = { '--since': since };
    if (until) {
       logOptions['--until'] = until;
    }
    const log = await git.log(logOptions);
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

export async function getUncommittedChanges(repoPath?: string): Promise<string> {
  const git = getGitInstance(repoPath);
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

export async function getBranchInfo(repoPath?: string): Promise<string> {
    const git = getGitInstance(repoPath);
    try {
        const branch = await git.branch();
        return `Current Branch: ${branch.current}\n`;
    } catch (error) {
        console.error("Error fetching branch info:", error);
        return "";
    }
}
