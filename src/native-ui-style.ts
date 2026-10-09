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
.dsh-completion-record-row{display:flex;flex-direction:column;align-items:stretch;text-align:left;width:100%;height:auto;padding:10px;gap:4px}
.dsh-completion-record-line{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0}
.dsh-completion-record-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--dsw-alias-label-secondary)}
.dsh-completion-record-section{display:grid;gap:6px;min-width:0}
.dsh-completion-record-text{margin:0;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:var(--dsw-alias-bg-base);border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm)}
.dsh-completion-picker{min-width:0;padding:0 8px}
`
