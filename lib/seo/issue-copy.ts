export type SeoIssueCode =
  | "missing_title"
  | "short_title"
  | "missing_meta_description"
  | "short_meta_description"
  | "missing_h1"
  | "images_without_alt"
  | "thin_content";

interface IssueCopyContext {
  titleLength?: number | null;
  metaDescriptionLength?: number | null;
  imagesWithoutAlt?: number | null;
  wordCount?: number | null;
}

export function getSeoIssueCopy(code: SeoIssueCode, context: IssueCopyContext = {}) {
  switch (code) {
    case "missing_title":
      return {
        title: "Missing title",
        description: "The page does not have a detected title element.",
        recommendation: "Add a unique and descriptive SEO title.",
      };
    case "short_title":
      return {
        title: "Title too short",
        description: `The title has ${context.titleLength ?? 0} characters.`,
        recommendation: "Extend the title to at least 30 characters.",
      };
    case "missing_meta_description":
      return {
        title: "Missing meta description",
        description: "The page does not have a meta description.",
        recommendation: "Add a unique description of roughly 120-160 characters.",
      };
    case "short_meta_description":
      return {
        title: "Description too short",
        description: `The description has ${context.metaDescriptionLength ?? 0} characters.`,
        recommendation: "Extend the description to communicate the page value clearly.",
      };
    case "missing_h1":
      return {
        title: "Missing H1",
        description: "The page does not contain an H1 heading.",
        recommendation: "Add one clear H1 that describes the main topic.",
      };
    case "images_without_alt":
      return {
        title: "Images without ALT",
        description: `${context.imagesWithoutAlt ?? 0} images do not have alternative text.`,
        recommendation: "Add descriptive ALT text to relevant images.",
      };
    case "thin_content":
      return {
        title: "Thin content",
        description: `The page has approximately ${context.wordCount ?? 0} words.`,
        recommendation: "Expand the page with useful content, H2 sections and FAQ.",
      };
  }
}
