import type { BlockSvg, WorkspaceSvg } from "blockly";

type BlocklyApi = typeof import("blockly");

const NESTED_WIDTH_FIELD = "NESTED_WIDTH";
const NESTED_WIDTH_SPACER_CHAR = "W";
const NESTED_CONTAINER_TYPES = new Set([
  "aviator_program",
  "aviator_if_simple",
  "aviator_if_statement",
  "aviator_elsif_clause",
  "aviator_for_statement",
  "aviator_while_statement"
]);

function nestedContainerContentWidth(block: BlockSvg, visiting = new Set<string>()): number {
  if (visiting.has(block.id)) return block.width;
  visiting.add(block.id);
  const origin = block.getRelativeToSurfaceXY();
  let width = block.width;
  for (const input of block.inputList) {
    let child = input.connection?.targetBlock() as BlockSvg | null;
    while (child) {
      const childOrigin = child.getRelativeToSurfaceXY();
      const childLeft = Math.max(0, childOrigin.x - origin.x);
      width = Math.max(width, childLeft + nestedContainerContentWidth(child, visiting) + 24);
      child = child.getNextBlock() as BlockSvg | null;
    }
  }
  visiting.delete(block.id);
  return width;
}

function nestedContainerDepth(block: BlockSvg) {
  let depth = 0;
  let parent = block.getParent() as BlockSvg | null;
  while (parent) {
    depth += 1;
    parent = parent.getParent() as BlockSvg | null;
  }
  return depth;
}

export function fitNestedBlockContainers(Blockly: BlocklyApi, workspace: WorkspaceSvg) {
  const containers = workspace.getAllBlocks(false).filter((block) => NESTED_CONTAINER_TYPES.has(block.type)) as BlockSvg[];
  if (!containers.length) return;

  Blockly.Events.disable();
  try {
    containers.sort((left, right) => nestedContainerDepth(right) - nestedContainerDepth(left));
    for (let pass = 0; pass < 2; pass += 1) {
      for (const block of containers) {
        const field = block.getField(NESTED_WIDTH_FIELD);
        if (!field) continue;
        if (block.getFieldValue(NESTED_WIDTH_FIELD)) block.setFieldValue("", NESTED_WIDTH_FIELD);
        const requiredWidth = nestedContainerContentWidth(block) + 24;
        const missingWidth = requiredWidth - block.width;
        if (missingWidth > 0) block.setFieldValue(NESTED_WIDTH_SPACER_CHAR.repeat(Math.ceil(missingWidth / 8)), NESTED_WIDTH_FIELD);
        block.render();
      }
    }
  } finally {
    Blockly.Events.enable();
  }
}
