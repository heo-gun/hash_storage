import type { TreeNode } from "../../types/fs";

/**
 * 그래프에 그릴 노드. 파일은 **hash_id 로 묶여 하나의 노드**가 되기 때문에
 * fs_nodes 한 행과 1:1 대응하지 않는다.
 */
export type GraphNode = {
  id: string;
  label: string;
  kind: "root" | "folder" | "file";
  /** 이 노드로 접히기 전의 fs_nodes 행들. 파일은 2개 이상이면 중복 저장분이다. */
  members: TreeNode[];
  hashId: string | null;
  sizeBytes: number;
  /** 서로 다른 부모 폴더의 수. 2 이상이면 "여러 부모를 가진 노드". */
  parentCount: number;
  radius: number;
  // d3-force 가 시뮬레이션 중 채워 넣는다.
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
};

export type Graph = {
  nodes: GraphNode[];
  links: GraphLink[];
  /** 부모가 둘 이상인 파일 노드 수 = 눈에 보이는 dedup 횟수 */
  dedupCount: number;
  /** dedup 으로 아끼고 있는 바이트 (같은 내용의 2번째 이후 사본들의 크기 합) */
  savedBytes: number;
};

export const ROOT_ID = "__root__";

/**
 * fs_nodes 목록을 그래프로 변환한다.
 *
 * 핵심: 같은 내용의 파일은 경로마다 별도 fs_nodes 행이지만 hash_id 가 같다.
 * 이것을 노드 하나로 접고 각 부모 폴더에서 엣지를 걸면, 저장소가 실제로
 * 하는 일(내용 한 벌 + 참조 여러 개)이 그대로 그림이 된다.
 */
export function buildGraph(rows: TreeNode[], rootLabel = "/"): Graph {
  const byId = new Map(rows.map((r) => [r.node_id, r]));

  const nodes = new Map<string, GraphNode>();
  // 같은 (부모, 자식) 쌍이 여러 번 나와도 엣지는 하나만 그린다.
  const linkKeys = new Set<string>();
  const links: GraphLink[] = [];

  nodes.set(ROOT_ID, {
    id: ROOT_ID,
    label: rootLabel,
    kind: "root",
    members: [],
    hashId: null,
    sizeBytes: 0,
    parentCount: 0,
    radius: 10,
  });

  /** 파일은 hash_id 로, 폴더는 자기 자신으로 식별한다. */
  const graphIdOf = (row: TreeNode): string =>
    row.node_type === "file" && row.hash_id
      ? `blob:${row.hash_id}`
      : row.node_id;

  for (const row of rows) {
    const id = graphIdOf(row);
    const existing = nodes.get(id);

    if (existing) {
      existing.members.push(row);
      // 이름이 경로마다 다를 수 있다. 가장 흔한 이름 하나를 대표로 쓰기보다,
      // 처음 만난 이름을 유지하고 나머지는 members 로 확인할 수 있게 둔다.
    } else {
      nodes.set(id, {
        id,
        label: row.name,
        kind: row.node_type === "file" ? "file" : "folder",
        members: [row],
        hashId: row.hash_id,
        sizeBytes: row.size_bytes ?? 0,
        parentCount: 0,
        radius: 5,
      });
    }

    // 부모가 목록에 없으면(잘려 들어온 경우 등) 루트에 붙인다.
    const parentRow = row.parent_id ? byId.get(row.parent_id) : null;
    const parentId = parentRow ? graphIdOf(parentRow) : ROOT_ID;

    const key = `${parentId}->${id}`;
    if (parentId !== id && !linkKeys.has(key)) {
      linkKeys.add(key);
      links.push({ source: parentId, target: id });
      nodes.get(id)!.parentCount += 1;
    }
  }

  let dedupCount = 0;
  let savedBytes = 0;
  for (const node of nodes.values()) {
    if (node.kind === "file" && node.members.length > 1) {
      dedupCount += 1;
      savedBytes += node.sizeBytes * (node.members.length - 1);
    }
    node.radius = radiusFor(node);
  }

  return { nodes: [...nodes.values()], links, dedupCount, savedBytes };
}

/** 폴더는 자식 수, 파일은 중복 횟수에 따라 커진다. 넓은 범위를 눌러야 해서 log. */
function radiusFor(node: GraphNode): number {
  if (node.kind === "root") return 11;
  if (node.kind === "folder") return 6;
  return 4.5 + Math.log2(node.members.length + 1) * 3;
}
