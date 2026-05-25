# Blender Mcp

**Source:** https://hermes-agent.nousresearch.com/docs/ko/user-guide/skills/optional/creative/creative-blender-mcp

Control Blender directly from Hermes via socket connection to the blender-mcp addon. Create 3D objects, materials, animations, and run arbitrary Blender Python (bpy) code. Use when user wants to create or modify anything in Blender.

## Skill metadata

Source

Optional — install with `hermes skills install official/creative/blender-mcp`

Path

`optional-skills/creative/blender-mcp`

Version

`1.0.0`

Author

alireza78a

Platforms

linux, macos, windows

## Reference: full SKILL.md

정보

The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.

# Blender MCP

Control a running Blender instance from Hermes via socket on TCP port 9876.

## Setup (one-time)

### 1\. Install the Blender addon

curl -sL [https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py](https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py) -o ~/Desktop/blender\_mcp\_addon.py

In Blender: Edit > Preferences > Add-ons > Install > select blender\_mcp\_addon.py Enable "Interface: Blender MCP"

### 2\. Start the socket server in Blender

Press N in Blender viewport to open sidebar. Find "BlenderMCP" tab and click "Start Server".

### 3\. Verify connection

nc -z -w2 localhost 9876 && echo "OPEN" || echo "CLOSED"

## Protocol

Plain UTF-8 JSON over TCP -- no length prefix.

Send: {"type": "<command>", "params": {<kwargs>}} Receive: {"status": "success", "result": <value>} {"status": "error", "message": "<reason>"}

## Available Commands

type

params

description

execute\_code

code (str)

Run arbitrary bpy Python code

get\_scene\_info

(none)

List all objects in scene

get\_object\_info

object\_name (str)

Details on a specific object

get\_viewport\_screenshot

(none)

Screenshot of current viewport

## Python Helper

Use this inside execute\_code tool calls:

import socket, json

def blender\_exec(code: str, host="localhost", port=9876, timeout=15): s = socket.socket(socket.AF\_INET, socket.SOCK\_STREAM) s.connect((host, port)) s.settimeout(timeout) payload = json.dumps({"type": "execute\_code", "params": {"code": code}}) s.sendall(payload.encode("utf-8")) buf = b"" while True: try: chunk = s.recv(4096) if not chunk: break buf += chunk try: json.loads(buf.decode("utf-8")) break except json.JSONDecodeError: continue except socket.timeout: break s.close() return json.loads(buf.decode("utf-8"))

## Common bpy Patterns

### Clear scene

bpy.ops.object.select\_all(action='SELECT') bpy.ops.object.delete()

### Add mesh objects

bpy.ops.mesh.primitive\_uv\_sphere\_add(radius=1, location=(0, 0, 0)) bpy.ops.mesh.primitive\_cube\_add(size=2, location=(3, 0, 0)) bpy.ops.mesh.primitive\_cylinder\_add(radius=0.5, depth=2, location=(-3, 0, 0))

### Create and assign material

mat = bpy.data.materials.new(name="MyMat") mat.use\_nodes = True bsdf = mat.node\_tree.nodes.get("Principled BSDF") bsdf.inputs\["Base Color"\].default\_value = (R, G, B, 1.0) bsdf.inputs\["Roughness"\].default\_value = 0.3 bsdf.inputs\["Metallic"\].default\_value = 0.0 obj.data.materials.append(mat)

### Keyframe animation

obj.location = (0, 0, 0) obj.keyframe\_insert(data\_path="location", frame=1) obj.location = (0, 0, 3) obj.keyframe\_insert(data\_path="location", frame=60)

### Render to file

bpy.context.scene.render.filepath = "/tmp/render.png" bpy.context.scene.render.engine = 'CYCLES' bpy.ops.render.render(write\_still=True)

## Pitfalls

-   Must check socket is open before running (nc -z localhost 9876)
-   Addon server must be started inside Blender each session (N-panel > BlenderMCP > Connect)
-   Break complex scenes into multiple smaller execute\_code calls to avoid timeouts
-   Render output path must be absolute (/tmp/...) not relative
-   shade\_smooth() requires object to be selected and in object mode
