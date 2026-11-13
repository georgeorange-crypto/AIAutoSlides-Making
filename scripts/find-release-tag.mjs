import {execFileSync} from 'node:child_process';

export function findReleaseTagForPullRequest(tagSubjects, pullRequestNumber) {
  return tagSubjects.find(({tag, subject}) => subject.trim() === `Release ${tag} for PR #${pullRequestNumber}`)?.tag ?? null;
}

if (process.argv[1]?.endsWith('find-release-tag.mjs')) {
  const pullRequestNumber = process.argv[2];
  if (!/^\d+$/.test(pullRequestNumber || '')) throw new Error('A numeric pull request number is required');
  const rows = execFileSync('git', ['for-each-ref', 'refs/tags', '--format=%(refname:short)%09%(contents:subject)'], {encoding:'utf8'});
  const tags = rows.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const [tag, ...subject] = line.split('\t');
    return {tag, subject:subject.join('\t')};
  });
  console.log(findReleaseTagForPullRequest(tags, pullRequestNumber) || '');
}
