/**
 * Maps a contract path segment to a filesystem folder name.
 * Path parameter segments (':myparam') become '+myparam' — ':' is not
 * a valid character in Windows folder names.
 */
export function segmentToFolderName(segment: string): string {
  return segment.startsWith(':') ? `+${segment.slice(1)}` : segment;
}
