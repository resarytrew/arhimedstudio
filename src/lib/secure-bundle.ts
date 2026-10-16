import type { Project } from "./store";

const FORMAT = "arhimed.secure-project.v1";
const ITERATIONS = 210_000;

interface EncryptedProjectBundle {
  format: typeof FORMAT;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const buffer = (value: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
};

async function keyFor(password: string, salt: Uint8Array) {
  if (password.length < 10) throw new Error("Ключевая фраза должна содержать не менее 10 символов.");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buffer(salt), iterations: ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypts the complete local project before it reaches the download API. */
export async function encryptProject(project: Project, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(project));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buffer(iv) }, key, plain));
  const bundle: EncryptedProjectBundle = { format: FORMAT, kdf: "PBKDF2-SHA-256", iterations: ITERATIONS, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) };
  return JSON.stringify(bundle);
}

export async function decryptProject(serialized: string, password: string): Promise<Project> {
  let bundle: EncryptedProjectBundle;
  try { bundle = JSON.parse(serialized) as EncryptedProjectBundle; } catch { throw new Error("Файл не является зашифрованным пакетом ArhimedStudio."); }
  if (bundle.format !== FORMAT || bundle.kdf !== "PBKDF2-SHA-256" || bundle.iterations !== ITERATIONS || !bundle.salt || !bundle.iv || !bundle.ciphertext) {
    throw new Error("Неподдерживаемый или повреждённый зашифрованный пакет.");
  }
  try {
    const key = await keyFor(password, decode(bundle.salt));
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buffer(decode(bundle.iv)) }, key, buffer(decode(bundle.ciphertext)));
    const project = JSON.parse(new TextDecoder().decode(data)) as Project;
    if (!project || typeof project !== "object" || !Array.isArray(project.scenes) || !project.scenes.length) throw new Error();
    return project;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ключевая")) throw error;
    throw new Error("Не удалось открыть пакет: неверная ключевая фраза или файл повреждён.");
  }
}

/** A public bundle intentionally omits private chats, audit history and local learner answers. */
export function publicLessonBundle(project: Project) {
  return JSON.stringify({
    format: "arhimed.lesson-bundle.v1",
    title: project.title,
    scenes: project.scenes.map(({ id, engineId, engineVersion, language, dialect, entrypoint, source, resources }) => ({ id, engineId, engineVersion, language, dialect, entrypoint, source, resources })),
    lesson: project.lesson,
    reproducibility: project.scenes.map(({ id, engineId, engineVersion, dialect, resources }) => ({ id, engineId, engineVersion, dialect, resources })),
  }, null, 2);
}
