#!/usr/bin/env node
import { Command } from 'commander';
import { getRecentCommits, getUncommittedChanges, getBranchInfo } from './gitOps';
import { summarizeWork } from './llm';
import dotenv from 'dotenv';
dotenv.config();

const program = new Command();

program
  .name('devlog-ai')
  .description('AI assistant for daily standups and PR descriptions based on git activity')
  .version('1.0.0');

program
  .command('standup')
  .description('Generate a daily standup report')
  .option('-d, --days <number>', 'Number of days to look back for commits', '1')
  .option('--date <string>', 'Specific date to look at (YYYY-MM-DD)')
  .option('-r, --repo <path>', 'Path to the git repository', '.')
  .action(async (options) => {
    console.log("Gathering Git activities...");
    const branch = await getBranchInfo(options.repo);
    const commits = await getRecentCommits({ 
        days: Number(options.days), 
        date: options.date, 
        repoPath: options.repo 
    });
    const uncommitted = await getUncommittedChanges(options.repo);

    const allGitData = `${branch}\n--- Recent Commits ---\n${commits}\n--- Uncommitted Changes ---\n${uncommitted}`;
    
    if (commits.length === 0 && uncommitted.includes('Modified files: 0')) {
        console.log("No recent git activity found.");
        return;
    }

    console.log("Analyzing with AI...");
    const report = await summarizeWork(allGitData, 'standup');
    console.log("\n====== DAILY STANDUP ======\n");
    console.log(report);
    console.log("\n===========================\n");
  });

program
  .command('pr')
  .description('Generate a detailed PR description')
  .option('-d, --days <number>', 'Number of days to look back for commits', '1')
  .option('--date <string>', 'Specific date to look at (YYYY-MM-DD)')
  .option('-r, --repo <path>', 'Path to the git repository', '.')
  .action(async (options) => {
    console.log("Gathering Git activities...");
    const branch = await getBranchInfo(options.repo);
    const commits = await getRecentCommits({ 
        days: Number(options.days), 
        date: options.date, 
        repoPath: options.repo 
    });
    const uncommitted = await getUncommittedChanges(options.repo);

    const allGitData = `${branch}\n--- Recent Commits ---\n${commits}\n--- Uncommitted Changes ---\n${uncommitted}`;

    console.log("Analyzing with AI...");
    const report = await summarizeWork(allGitData, 'pr');
    console.log("\n====== PULL REQUEST DESCRIPTION ======\n");
    console.log(report);
    console.log("\n======================================\n");
  });

program.parse(process.argv);
