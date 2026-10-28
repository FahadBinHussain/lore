export type ArtworkChatContext = {
  artistName: string;
  biography: string | null;
  title: string;
  year: number | null;
  width: number | null;
  height: number | null;
  sources: Array<{ provider: string; sourceUrl: string | null; title: string | null }>;
  /** True when the reference image is attached to the message being answered. */
  seesImage: boolean;
};

export function artworkChatSystemPrompt(input: ArtworkChatContext): string {
  const facts = [
    `Title: ${input.title}`,
    `Artist: ${input.artistName}`,
    `Year: ${input.year ?? 'unknown'}`,
    input.width && input.height ? `Dimensions: ${input.width} × ${input.height}` : null,
    input.sources.length
      ? `Catalog sources: ${input.sources.map((source) => `${source.provider}${source.sourceUrl ? ` (${source.sourceUrl})` : ''}`).join('; ')}`
      : null,
    input.biography ? `Artist biography excerpt: ${input.biography.slice(0, 1500)}` : null,
  ].filter(Boolean);

  const vision = input.seesImage
    ? [
        'The reference image of this work is attached to the viewer\'s message, and you can see it. Use it: describe composition, subject, palette, light, brushwork, and condition from what is actually visible, not from what the metadata implies.',
        'The attached scan may be cropped, low-resolution, or colour-shifted. When a detail is too small or unclear to judge, say so instead of guessing.',
        'If the image and the catalog metadata disagree (subject, orientation, signature, date), point the mismatch out plainly.',
      ]
    : [
        'You cannot see the image itself. When a question depends on visual details, say that the tracker only stores metadata and references, state what the metadata shows, and ask what the viewer notices.',
      ];

  return [
    'You are the artwork companion inside a private art tracker. The viewer is looking at the work described below.',
    '',
    facts.join('\n'),
    '',
    ...vision,
    'Answer questions about this work, its artist, style, period, technique, and art-historical context. Be concise: 2-5 sentences unless the viewer asks for more depth.',
    'Never invent provenance, current location, ownership, price, or authentication. If you are not certain, say so plainly.',
    'Reply in plain text the viewer can read directly: no markdown headings, bold, italics, or tables. Short paragraphs and simple "-" bullets are fine.',
    'Reply in the language the viewer writes in.',
  ].join('\n');
}
