#include <metal_stdlib>
using namespace metal;

struct Part {
    float4 centerKind;
    float4 radiiRoundness;
    float4 axisX;
    float4 axisY;
    float4 axisZ;
    float4 colorBlend;
    float4 surfaceProfile; // morph, tip, base, top scale
    float4 extra;          // bottom scale
};

struct Scene {
    float4 transform;    // translation x/y, scale x/y
    float4 bodyPaint;    // linear RGB, opacity
    float4 eyePaint;     // linear RGB, perspective
    float4 outline;      // linear RGB, design width
    float4 display;      // viewport radius, studio material, studio background, outline opacity
    float4 textures;     // face atlas radius, face visible, mark atlas radius, grayscale
    float4 spinner;      // center x/y, disk radius, blend
    float4 spinnerStyle; // opacity, drop, turn, reserved
    float4 geometry;     // part count, bound radius
};

struct Surface {
    float distance;
    uint index;
};

constant float3 key = float3(-0.405, 0.710, 0.576);
constexpr sampler atlasSampler(coord::normalized, address::clamp_to_zero, filter::linear);

static float3 toLocal(float3 vector, constant Part &part) {
    return float3(dot(vector, part.axisX.xyz), dot(vector, part.axisY.xyz), dot(vector, part.axisZ.xyz));
}

static float minAxis(float3 radii) {
    return min(min(radii.x, radii.y), radii.z);
}

static float ellipsoid(float3 p, float3 radii) {
    float3 q = p / radii;
    float size = length(q);
    return (size - 1.0) * max(size, 0.0001) / max(length(q / radii), 0.0002);
}

static float powerField(float3 q, float power) {
    q = abs(q);
    if (power >= 22.0) return max(max(q.x, q.y), q.z) - 1.0;
    float3 powers = pow(q, float3(power));
    return pow(powers.x + powers.y + powers.z, 1.0 / power) - 1.0;
}

static float cylinder(float3 p, float3 r) {
    float2 d = float2((length(p.xz / r.xz) - 1.0) * min(r.x, r.z), abs(p.y) - r.y);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

static float primitive(float3 world, constant Part &part) {
    float3 p = toLocal(world - part.centerKind.xyz, part);
    float3 r = part.radiiRoundness.xyz;
    float roundness = saturate(part.radiiRoundness.w);
    float y = clamp(p.y / r.y, -1.0, 1.0);
    float small = minAxis(r);
    float morph = saturate(part.surfaceProfile.x);

    switch (uint(part.centerKind.w)) {
    case 1: // cube
        return powerField(p / r, mix(24.0, 2.0, roundness)) * small;
    case 2: { // capsule
        float cap = min(r.x, r.y);
        p.y = copysign(max(0.0, abs(p.y) - (r.y - cap)), p.y);
        r.y = cap;
        return ellipsoid(p, r);
    }
    case 3: { // cylinder
        float corner = small * roundness * 0.49;
        float body = cylinder(p, max(r - corner, 0.001)) - corner;
        return mix(body, ellipsoid(p, r), morph);
    }
    case 4: { // cone
        float t = 0.5 * (y + 1.0);
        float tip = saturate(part.surfaceProfile.y);
        float base = saturate(part.surfaceProfile.z);
        float side = mix(1.0 - t, sqrt(max(0.0, 1.0 - y * y)), morph);
        side *= 1.0 - base * 0.42 * exp(-18.0 * t);
        side += tip * 0.18 * sin(3.14159265 * t);
        float q = length(p.xz / r.xz);
        return max((q - side) * min(r.x, r.z) * 0.71, abs(p.y) - r.y);
    }
    case 5: // diamond
        return powerField(p / r, mix(1.0, 2.0, roundness)) * (small * 0.60);
    case 6: { // trapezoid
        float t = 0.5 * (1.0 - y);
        float sx = mix(part.surfaceProfile.w, part.extra.x, t);
        float sz = mix(0.92, 1.04, t);
        return powerField(p / (r * float3(sx, 1.0, sz)), mix(24.0, 2.0, roundness)) * small * 0.65;
    }
    case 7: { // tapered beak
        float f = clamp(p.z / r.z, -1.0, 1.0);
        r.x *= (1.0 + 0.32 * y) * (1.0 - 0.43 * f);
        r.y *= 1.0 - 0.38 * f;
        return ellipsoid(p, r);
    }
    default:
        return ellipsoid(p, r);
    }
}

static Surface sample(float3 p, constant Part *parts, uint count) {
    Surface nearest = {primitive(p, parts[0]), 0};
    for (uint index = 1; index < count; ++index) {
        float d = primitive(p, parts[index]);
        float blend = parts[index].colorBlend.w;
        if (blend > 0.0001) {
            float k = max(blend - abs(nearest.distance - d), 0.0) / blend;
            if (d < nearest.distance) nearest.index = index;
            nearest.distance = min(nearest.distance, d) - k * k * blend * 0.25;
        } else if (d < nearest.distance) {
            nearest = {d, index};
        }
    }
    return nearest;
}

static float2 rayBounds(float3 origin, float3 ray, float radius) {
    float projection = dot(origin, ray);
    float discriminant = projection * projection - dot(origin, origin) + radius * radius;
    if (discriminant < 0) return float2(1, 0);
    float span = sqrt(discriminant);
    return float2(-projection - span, -projection + span);
}

static float ellipseEntry(float3 origin, float3 ray, constant Part &part) {
    float3 o = toLocal(origin - part.centerKind.xyz, part) / part.radiiRoundness.xyz;
    float3 v = toLocal(ray, part) / part.radiiRoundness.xyz;
    float a = dot(v, v);
    float b = dot(o, v);
    float d = b * b - a * (dot(o, o) - 1.0);
    return d >= 0.0 ? (-b - sqrt(d)) / a : INFINITY;
}

static float3 normalAt(float3 p, constant Part *parts, uint count) {
    float2 h = float2(0.0015, -0.0015);
    return normalize(h.xyy * sample(p + h.xyy, parts, count).distance
                   + h.yyx * sample(p + h.yyx, parts, count).distance
                   + h.yxy * sample(p + h.yxy, parts, count).distance
                   + h.xxx * sample(p + h.xxx, parts, count).distance);
}

static float3 studioLight(float3 p, float3 view, uint index, constant Part *parts, uint count) {
    const float3 base = parts[index].colorBlend.xyz;
    float3 n = normalAt(p, parts, count);
    float top = saturate(dot(n, key));
    float fill = saturate(dot(n, float3(0.794, 0.202, 0.573)));
    float rim = saturate(dot(n, float3(0.60, 0.22, -0.77)));
    float near = saturate(1.0 - sample(p + n * 0.047, parts, count).distance / 0.047);
    float wide = saturate(1.0 - sample(p + n * 0.112, parts, count).distance / 0.112);
    float occlusion = 1.0 - 0.18 * near - 0.19 * wide;
    if (uint(parts[index].centerKind.w) == 7) {
        float sheen = pow(saturate(dot(n, normalize(key + view))), 18.0) * 0.038;
        return (base * (0.64 + 0.37 * top + 0.12 * fill) + sheen * float3(1.0, 0.83, 0.52)) * occlusion;
    }
    float visibility = 1.0;
    if (index == 0) {
        float clearance = sample(p + n * 0.004 + key * 0.082, parts, count).distance;
        visibility = mix(0.88, 1.0, saturate(clearance / 0.035));
    }
    return base * (0.73 + 0.34 * top + 0.10 * fill + 0.14 * rim) * occlusion * visibility;
}

static float4 premultiply(float3 color, float alpha) {
    return float4(color * alpha, alpha);
}

static float4 over(float4 layer, float4 behind) {
    return layer + behind * (1.0 - layer.a);
}

static float3 backdrop(float2 uv) {
    float2 local = uv * float2(0.72, 0.91);
    float weight = exp(-dot(local, local) * 0.84);
    return mix(float3(0.829, 0.865, 0.932), float3(0.969, 0.966, 0.956), weight);
}

static float3 toSRGB(float3 linear) {
    float3 x = saturate(linear);
    return select(1.055 * pow(x, float3(1.0 / 2.4)) - 0.055, 12.92 * x, x <= 0.0031308);
}

static float3 gray(float3 rgb, float share) {
    return mix(rgb, float3(dot(rgb, float3(0.2126, 0.7152, 0.0722))), share);
}

kernel void renderAvatar(texture2d<float, access::write> output [[texture(0)]],
                         texture2d<float> face [[texture(1)]],
                         texture2d<float> marks [[texture(2)]],
                         constant Part *parts [[buffer(0)]],
                         constant Scene &scene [[buffer(1)]],
                         uint2 pixel [[thread_position_in_grid]]) {
    const uint width = output.get_width();
    const uint height = output.get_height();
    if (pixel.x >= width || pixel.y >= height) return;
    float2 size = float2(width, height);
    float2 uv = (2.0 * (float2(pixel) + 0.5) - size) / min(size.x, size.y);
    uv.y *= -1.0;
    float2 plane = uv * scene.display.x;
    float opacity = scene.bodyPaint.w;
    float round = scene.spinner.w;
    float bodyAlpha = opacity * (1.0 - round);
    uint count = uint(scene.geometry.x);

    float2 markUV = float2(0.5) + float2(plane.x, -plane.y) / (2.0 * scene.textures.z);
    float mark = marks.sample(atlasSampler, markUV).r * opacity;
    float4 avatar = premultiply(scene.bodyPaint.xyz, mark);

    if (bodyAlpha > 0.0001 && count > 0) {
        bool studio = scene.display.y > 0.5;
        float z = max(scene.geometry.y + 0.15, 3.95);
        float2 scale = scene.transform.zw;
        float2 point = (plane - scene.transform.xy) / scale;
        float3 origin = float3(point, z);
        float3 ray = float3(0, 0, -1);
        if (studio) {
            origin.xy = (float2(0, 0.032) - scene.transform.xy) / scale;
            ray = normalize(float3(plane / (scale * z), -1));
        }
        float2 limits = rayBounds(origin, ray, scene.geometry.y + scene.outline.w);
        float travel = max(0.0, limits.x);
        float closest = INFINITY;
        bool hit = false;
        uint index = 0;
        for (uint step = 0; step < 76 && travel < limits.y; ++step) {
            Surface surface = sample(origin + ray * travel, parts, count);
            closest = min(closest, surface.distance);
            if (surface.distance < 0.00092) {
                hit = true;
                index = surface.index;
                break;
            }
            travel += max(surface.distance * 0.80, 0.0005);
        }
        if (!hit && limits.x < limits.y) {
            float entry = INFINITY;
            for (uint i = 0; i < count; ++i) {
                if (uint(parts[i].centerKind.w) != 0) continue;
                float near = ellipseEntry(origin, ray, parts[i]);
                if (near < entry) {
                    entry = near;
                    index = i;
                }
            }
            if (entry < limits.y) {
                travel = entry;
                hit = true;
            }
        }
        if (hit) {
            float3 p = origin + ray * travel;
            float3 color = studio ? studioLight(p, -ray, index, parts, count) : parts[index].colorBlend.xyz;
            if (index == 0 && scene.textures.y > 0.0) {
                float3 local = toLocal(p - parts[0].centerKind.xyz, parts[0]);
                if (local.z > 0.0) {
                    float2 position = local.xy;
                    float curve = saturate(scene.eyePaint.w / 3.0);
                    float lateral = saturate(abs(local.x) / parts[0].radiiRoundness.x);
                    position.x *= 1.0 + 0.22 * curve * lateral * lateral;
                    float2 faceUV = float2(0.5) + float2(position.x, -position.y) / (2.0 * scene.textures.x);
                    color = mix(color, scene.eyePaint.xyz, face.sample(atlasSampler, faceUV).r * scene.textures.y);
                }
            }
            avatar = over(premultiply(color, bodyAlpha), avatar);
        } else if (scene.outline.w > 0 && isfinite(closest)) {
            float antialias = 2.0 * scene.display.x / min(size.x, size.y);
            float outline = 1.0 - smoothstep(scene.outline.w - antialias, scene.outline.w + antialias, closest);
            avatar = over(premultiply(scene.outline.xyz, outline * scene.display.w * bodyAlpha), avatar);
        }
    }

    if (round > 0.0 && scene.spinner.z > 0.0) {
        float2 p = plane - scene.spinner.xy;
        float angle = scene.spinnerStyle.z;
        p = float2(p.x * cos(angle) - p.y * sin(angle), p.x * sin(angle) + p.y * cos(angle));
        float radius = scene.spinner.z;
        float distance = length(p);
        if (scene.spinnerStyle.y > 0.5) {
            distance = length(float2(p.x * (1.0 + 0.7 * saturate(-p.y / radius)), p.y * 0.78));
        }
        float edge = scene.display.x / min(size.x, size.y);
        float a = (1.0 - smoothstep(radius - edge, radius + edge, distance)) * opacity * round * scene.spinnerStyle.x;
        avatar = over(premultiply(scene.bodyPaint.xyz, a), avatar);
    }

    float4 background = scene.display.z > 0.5 ? float4(backdrop(uv), 1.0) : float4(0);
    avatar.rgb = gray(avatar.rgb, scene.textures.w);
    float4 composited = over(avatar, background);
    float3 color = composited.a > 0.00001 ? toSRGB(composited.rgb / composited.a) * composited.a : float3(0);
    output.write(float4(color, composited.a), pixel);
}
