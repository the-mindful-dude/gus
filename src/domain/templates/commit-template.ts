export const TEMPLATE_PLACEHOLDERS = [
  'type',
  'scope',
  'scope_suffix',
  'summary',
  'body',
  'footer',
] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export const REQUIRED_TEMPLATE_PLACEHOLDERS: readonly TemplatePlaceholder[] = ['summary'];

export function isTemplatePlaceholder(value: string): value is TemplatePlaceholder {
  return (TEMPLATE_PLACEHOLDERS as readonly string[]).includes(value);
}

export interface CommitTemplate {
  raw: string;
  templateBlock: string;
  rules: string[];
  placeholders: string[];
}

export interface TemplateContext {
  type?: string;
  scope?: string;
  summary: string;
  body?: string;
  footer?: string;
}
