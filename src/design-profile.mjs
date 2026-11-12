const THEMES=['academic-light','tech-dark','keynote-minimal'];
export function createDesignProfile(gallery,theme,reviewer,confirmedAt=new Date().toISOString()){
  if(!THEMES.includes(theme)||!gallery.themes?.some(item=>item.id===theme))throw new Error(`Theme ${theme} is not present in the generated gallery`);
  if(!reviewer?.trim())throw new Error('A reviewer name is required to record design confirmation');
  const chosen=gallery.themes.find(item=>item.id===theme);
  return{schema_version:1,name:'AIAutoSlides confirmed design',selected_theme:theme,confirmed_by:reviewer.trim(),confirmed_at:confirmedAt,source_storyboard_sha256:gallery.source_storyboard_sha256,preview:{cover:chosen.preview,chart:chosen.chart_preview,rendered:chosen.rendered},tokens:chosen.tokens,layout_principles:['Use native editable text, shapes and charts.','Keep source verification state and chart units visible.','Treat slide critique rules as review prompts; human reviewers resolve context-specific conflicts.']};
}
