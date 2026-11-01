import {
  type CommitTemplate,
  REQUIRED_TEMPLATE_PLACEHOLDERS,
  type TemplateContext,
  type TemplatePlaceholder,
  isTemplatePlaceholder,
} from '../../domain/templates/commit-template.js';

export function validateTemplate(template: CommitTemplate, context: TemplateContext): boolean {
  if (template.placeholders.some((placeholder) => !isTemplatePlaceholder(placeholder))) {
    return false;
  }

  const hasRequiredPlaceholders = REQUIRED_TEMPLATE_PLACEHOLDERS.every((placeholder) =>
    template.placeholders.includes(placeholder),
  );
  if (!hasRequiredPlaceholders) {
    return false;
  }

  if (context.summary.trim().length === 0) {
    return false;
  }

  return true;
}

export function renderTemplate(template: CommitTemplate, context: TemplateContext): string {
  const values: Record<TemplatePlaceholder, string> = {
    type: context.type ?? '',
    scope: context.scope ?? '',
    scope_suffix: context.scope ? `(${context.scope})` : '',
    summary: context.summary,
    body: context.body ?? '',
    footer: context.footer ?? '',
  };

  let result = template.templateBlock.replace(
    /\{\{([a-z][a-z0-9_]*)\}\}/g,
    (match, name: string) => (isTemplatePlaceholder(name) ? values[name] : match),
  );

  result = result.replace(/\n\n\n+/g, '\n\n');
  result = result.trim();

  return result;
}
