/** Completion surfaces inherit the same controls, menu material and semantic colors as the composer. */
export const NATIVE_UI_STYLE = `
.dsh-completion-icon{width:28px;padding:0;flex:0 0 auto}
.dsh-completion-popover{width:300px;max-width:calc(100vw - 24px)}
.dsh-completion-behind-dialog{opacity:0;pointer-events:none}
.dsh-completion-heading{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-completion-enable{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsh-completion-dialog{width:min(600px,100%);max-height:100%}
.dsh-completion-content{min-height:0;overflow-y:auto}
.dsh-completion-settings{display:grid;gap:14px;min-width:0;width:100%}
.dsh-completion-settings-section{display:grid;gap:12px;min-width:0;padding:0 0 16px;border-bottom:0.5px solid var(--dsw-alias-border-l4)}
.dsh-completion-settings-section h3{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-completion-dependent{display:grid;gap:8px;padding:12px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base)}
.dsh-completion-row{display:grid;min-width:0;gap:6px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-completion-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.dsh-completion-error{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:0 14px}
.dsh-completion-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:4px 8px}
.dsh-completion-footer{display:flex;gap:8px;justify-content:flex-end;padding:4px 8px}
.dsh-completion-capture{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
@media(max-width:480px){.dsh-completion-pair{grid-template-columns:minmax(0,1fr)}}
.dsh-completion-actions{display:flex;gap:2px}
.dsh-completion-record-dialog{width:min(720px,100%);max-height:100%}
.dsh-completion-record-list,.dsh-completion-record-detail{display:grid;gap:8px;min-width:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-completion-record-toolbar{display:grid;gap:10px;margin:8px 0 12px;min-width:0}
.dsh-completion-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0}
.dsh-completion-metrics>div{display:grid;gap:6px;padding:12px;background:var(--dsw-alias-bg-base);border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm)}
.dsh-completion-metrics span{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsh-completion-metrics strong{font-size:16px;overflow-wrap:anywhere}
.dsh-completion-source{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsh-completion-source>span:first-child{flex:0 0 auto}
.dsh-completion-source-link{min-width:0;height:auto;padding:2px 4px;text-align:left;white-space:normal;overflow-wrap:anywhere;color:var(--dsw-alias-link)}
.dsh-completion-source-link:hover,.dsh-completion-source-link:focus-visible{text-decoration:underline dotted;text-underline-offset:3px}
.dsh-completion-record-row{display:flex;flex-direction:column;align-items:stretch;text-align:left;width:100%;height:auto;padding:10px;gap:4px}
.dsh-completion-record-line{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0}
.dsh-completion-record-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--dsw-alias-label-secondary)}
.dsh-completion-record-section{display:grid;gap:6px;min-width:0}
.dsh-completion-record-text{margin:0;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:var(--dsw-alias-bg-base);border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm)}
.dsh-completion-picker{min-width:0;padding:0 8px}
`
