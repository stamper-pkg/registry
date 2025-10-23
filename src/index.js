// stamper registry entry point
// written by primiti-ve on github

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { pathname, searchParams } = url;

      // Basic rate limit (simple in-memory demo)
      if (!env.REQUEST_COUNT) env.REQUEST_COUNT = 0;
      env.REQUEST_COUNT++;
      if (env.REQUEST_COUNT > 30) {
        return new Response(
          JSON.stringify({
            error: "Too many requests. Please try again later.",
          }),
          {
            status: 429,
            headers: { "content-type": "application/json" },
          }
        );
      }

      if (pathname === "/packages/new" && request.method === "POST") {
        return handleNewPackage(request, env, searchParams);
      }

      if (pathname === "/packages/update" && request.method === "PUT") {
        return handleUpdatePackage(request, env, searchParams);
      }

      if (pathname === "/packages/get" && request.method === "GET") {
        return handleGetPackage(env, searchParams);
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};

// --- 🧱 Helper functions ---
async function handleNewPackage(request, env, params) {
  const owner = sanitize(params.get("owner"));
  const name = sanitize(params.get("name"));
  const version = sanitize(params.get("version") || "0.1.0");

  const key = `${owner}/${name}/${version}`;
  const existing = await env.PACKAGES.get(key);

  if (existing) {
    // redirect to update
    return handleUpdatePackage(request, env, params);
  }

  const body = await request.json();
  const content = body?.content || "default package content";

  await env.PACKAGES.put(key, content);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return jsonResponse(
    {
      message: "Package version initialized successfully",
      owner,
      name,
      version,
      hash,
    },
    201
  );
}

async function handleUpdatePackage(request, env, params) {
  const owner = sanitize(params.get("owner"));
  const name = sanitize(params.get("name"));
  const version = sanitize(params.get("version") || "0.1.0");

  const key = `${owner}/${name}/${version}`;
  const existing = await env.PACKAGES.get(key);

  if (!existing) {
    return jsonResponse({ error: "Package version not found" }, 404);
  }

  const body = await request.json();
  const newContent = body?.content;
  if (!newContent) {
    return jsonResponse(
      { error: "Missing 'content' field in request body" },
      400
    );
  }

  await env.PACKAGES.put(key, newContent);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(newContent)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return jsonResponse({
    message: "Package version updated successfully",
    owner,
    name,
    version,
    hash,
  });
}

async function handleGetPackage(env, params) {
  const owner = sanitize(params.get("owner"));
  const name = sanitize(params.get("name"));
  const version = sanitize(params.get("version") || "0.1.0");

  const key = `${owner}/${name}/${version}`;
  const content = await env.PACKAGES.get(key);

  if (!content) {
    return jsonResponse({ error: "Package version not found" }, 404);
  }

  return new Response(content, {
    headers: {
      "x-timestamp": Date.now().toString(),
      "x-sent": "true",
      "content-type": "text/plain",
    },
  });
}

// --- 🔧 Utils ---
function sanitize(str = "") {
  return str.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
