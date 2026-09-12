import * as THREE from 'three';
import { clamp, damp } from './util.js';

/* =========================================================
   RTS-камера: панорама, зум, вращение, тряска, слежение
   ========================================================= */
export class CameraRig {
  constructor(camera, map) {
    this.camera = camera;
    this.map = map;
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = new THREE.Vector3(0, 0, 0);
    this.yaw = Math.PI;         // смотрим «на север» карты
    this.yawGoal = Math.PI;
    this.pitch = 0.92;
    this.pitchGoal = 0.92;
    this.distance = 46;
    this.distanceGoal = 46;
    this.minDist = 16;
    this.maxDist = 110;
    this.panSpeed = 46;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.shakeDur = 0.3;
    this.edgePan = { x: 0, z: 0 };
    this.keys = {};
    this.followTarget = null;
    this.offset = new THREE.Vector3();
  }

  focus(x, z, instant = false) {
    this.goal.set(x, this.map ? this.map.heightAt(x, z) : 0, z);
    if (instant) this.target.copy(this.goal);
  }

  pan(dx, dz) {
    this.goal.x = clamp(this.goal.x + dx, -this.map.worldSize / 2 + 6, this.map.worldSize / 2 - 6);
    this.goal.z = clamp(this.goal.z + dz, -this.map.worldSize / 2 + 6, this.map.worldSize / 2 - 6);
  }

  /** Панорама в экранных осях (WASD/края экрана) */
  panScreen(dx, dz, dt) {
    const s = this.panSpeed * dt * (this.distance / 46);
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    // вперёд/назад по направлению взгляда
    this.pan(sin * dz * s + cos * dx * s, cos * dz * s - sin * dx * s);
  }

  zoom(delta, px = 0.5, py = 0.5) {
    const before = this.distance;
    this.distanceGoal = clamp(this.distanceGoal * (1 + delta), this.minDist, this.maxDist);
    // зум к курсору
    const k = 1 - this.distanceGoal / before;
    if (Math.abs(k) > 0.001) {
      const nx = (px - 0.5) * 2, ny = (py - 0.5) * 2;
      const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
      const rightX = cos, rightZ = -sin;
      const fwdX = sin, fwdZ = cos;
      const amt = this.distanceGoal * 0.55 * k;
      this.goal.x += (rightX * nx - fwdX * ny) * amt;
      this.goal.z += (rightZ * nx - fwdZ * ny) * amt;
    }
  }

  rotate(d) { this.yawGoal += d; }

  shake(amp, dur = 0.3) {
    if (amp > this.shakeAmp) { this.shakeAmp = amp; this.shakeTime = 0; this.shakeDur = dur; }
  }

  update(dt) {
    // клавиши
    let kx = 0, kz = 0;
    if (this.keys['w'] || this.keys['arrowup']) kz += 1;
    if (this.keys['s'] || this.keys['arrowdown']) kz -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) kx += 1;
    if (this.edgePan.x || this.edgePan.z) { kx += this.edgePan.x; kz += this.edgePan.z; }
    if (kx || kz) {
      const l = Math.hypot(kx, kz) || 1;
      this.panScreen(kx / l, kz / l, dt);
    }
    if (this.keys['q']) this.yawGoal -= dt * 1.8;
    if (this.keys['e']) this.yawGoal += dt * 1.8;

    // следование за целью
    if (this.followTarget && !this.followTarget.dead) {
      this.goal.x = this.followTarget.x; this.goal.z = this.followTarget.z;
    }

    const l = 12;
    this.target.x = damp(this.target.x, this.goal.x, l, dt);
    this.target.z = damp(this.target.z, this.goal.z, l, dt);
    this.target.y = damp(this.target.y, this.goal.y, 8, dt);
    this.yaw = damp(this.yaw, this.yawGoal, 10, dt);
    this.pitch = damp(this.pitch, this.pitchGoal, 8, dt);
    this.distance = damp(this.distance, this.distanceGoal, 9, dt);

    // тряска
    let sx = 0, sy = 0, sz = 0;
    if (this.shakeAmp > 0.001) {
      this.shakeTime += dt;
      const k = 1 - this.shakeTime / this.shakeDur;
      if (k <= 0) { this.shakeAmp = 0; }
      else {
        const a = this.shakeAmp * k * k;
        sx = (Math.random() - 0.5) * a * 3;
        sy = (Math.random() - 0.5) * a * 3;
        sz = (Math.random() - 0.5) * a * 3;
      }
    }

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.offset.set(
      Math.sin(this.yaw) * cp * this.distance,
      sp * this.distance,
      Math.cos(this.yaw) * cp * this.distance,
    );
    this.camera.position.set(
      this.target.x + this.offset.x + sx,
      Math.max(2.5, this.target.y + this.offset.y) + sy,
      this.target.z + this.offset.z + sz,
    );
    this.camera.lookAt(this.target.x + sx * 0.4, this.target.y + sy * 0.4, this.target.z + sz * 0.4);

    // адаптивный FOV для эффекта скорости
    const fovGoal = 52 + (this.distanceGoal - 46) * 0.06;
    this.camera.fov = damp(this.camera.fov, fovGoal, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  distanceTo(x, y, z) {
    return this.camera.position.distanceTo({ x, y, z });
  }

  /** Нормализованная громкость по дистанции от камеры */
  attenuation(x, y, z) {
    const d = this.distanceTo(x, y, z);
    return clamp(1 - (d - 30) / 130, 0.05, 1);
  }

  screenToWorld(ndcX, ndcY, ground) {
    const ray = new THREE.Ray();
    const raycaster = new THREE.Raycaster();
    // матрицы могли ещё не обновиться (например, до первого рендера)
    this.camera.updateMatrixWorld();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    ray.copy(raycaster.ray);
    const t = (ground - ray.origin.y) / ray.direction.y;
    if (t < 0) return null;
    return {
      x: ray.origin.x + ray.direction.x * t,
      z: ray.origin.z + ray.direction.z * t,
    };
  }
}
