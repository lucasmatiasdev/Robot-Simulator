/**
 * RS.ui.resaltar(blockId | null) — the single double-feedback call site.
 * Highlights the Blockly block AND marks the corresponding C++ code line
 * in one call, so the two views cannot desynchronize.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  var workspaceRef = null;

  RS.ui.initHighlight = function (workspace) {
    workspaceRef = workspace;
  };

  RS.ui.resaltar = function (blockId) {
    if (workspaceRef) {
      workspaceRef.highlightBlock(blockId || null);
    }
    if (RS.ui.codePanel) {
      RS.ui.codePanel.marcarLinea(blockId || null);
    }
  };
})(typeof window !== 'undefined' ? window : this);
