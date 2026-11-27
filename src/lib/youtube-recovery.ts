export function isYouTubeContentError(code: number) {
  return code === 100 || code === 101 || code === 150;
}

export function nextYouTubeTrack(
  length: number,
  reportedIndex: number,
  requestedIndex: number | undefined,
  visited: Set<number>,
) {
  if (length === 0) return null;
  const hasReportedIndex = Number.isInteger(reportedIndex) && reportedIndex >= 0 && reportedIndex < length;
  // A failed track may never become the current track in the iframe.
  const failedIndex = hasReportedIndex && (requestedIndex === undefined || !visited.has(reportedIndex))
    ? reportedIndex
    : requestedIndex ?? 0;
  visited.add(failedIndex);

  for (let step = 1; step < length; step++) {
    const index = (failedIndex + step) % length;
    if (!visited.has(index)) return index;
  }
  return null;
}
