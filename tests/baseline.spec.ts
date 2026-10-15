import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('all original scenes: deterministic frames, finite geometry, timings', async ({ page }, info) => {
  await page.goto('/');
  const report = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the source modules for this browser-only regression harness.
    const {runScript, framAt} = await import('/src/engine/interpreter.ts');
    // @ts-expect-error browser module
    const {renderScene} = await import('/src/engine/renderer.ts');
    // @ts-expect-error browser module
    const {TEMPLATES,WELCOME_CODE,genericCode} = await import('/src/lib/templates.ts');
    // @ts-expect-error browser module
    const {loadEngineFonts} = await import('/src/engine/fonts.ts');
    await loadEngineFonts();
    const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=360;
    const ctx=canvas.getContext('2d')!;
    const results=[];
    for(const scene of [{id:'welcome',code:WELCOME_CODE},...TEMPLATES,{id:'generic',code:genericCode('Проверка')}]) {
      const times=[];
      let timeline;
      for(let i=0;i<30;i++){const start=performance.now();timeline=runScript(scene.code);times.push(performance.now()-start);}
      const frames=[];
      for(const t of [0,timeline.duration/2,timeline.duration]) {
        const frame=framAt(timeline,t);
        const encoded=JSON.stringify(frame);
        if(encoded.includes('null') && frame.some((m:any)=>m.pos.some((n:number)=>!Number.isFinite(n)))) throw Error('Nonfinite position');
        renderScene(ctx,640,360,frame,timeline.bg);
        frames.push({t,png:canvas.toDataURL('image/png')});
      }
      times.sort((a,b)=>a-b);
      results.push({id:scene.id,duration:timeline.duration,segments:timeline.segments.length,p50:times[14],p95:times[28],frames});
    }
    return results;
  });
  for(const scene of report){
    expect(scene.duration).toBeGreaterThan(0);
    expect(scene.segments).toBeGreaterThan(0);
    for(let i=0;i<scene.frames.length;i++) expect(Buffer.from(scene.frames[i].png.split(',')[1],'base64')).toMatchSnapshot(`${scene.id}-${i}.png`,{maxDiffPixelRatio:0.001});
  }
  await info.attach('baseline-timings.json',{body:JSON.stringify({browser:await page.context().browser()!.version(),scenes:report.map(({frames,...r})=>r)},null,2),contentType:'application/json'});
});

test('Canvas interpreter reports an incomplete call with a source line', async ({ page }) => {
  await page.goto('/');
  const error = await page.evaluate(async () => {
    // @ts-expect-error browser source module
    const { runScript } = await import('/src/engine/interpreter.ts');
    try {
      runScript('import manimx as m\nclass Broken(m.Scene):\n    def construct(self):\n        broken(\n');
      return null;
    } catch (value) {
      return { message: String(value), line: (value as { line?: number }).line };
    }
  });
  expect(error).toEqual({ message: 'Error: Синтаксическая ошибка: Ожидалась «)», найден конец строки', line: 4 });
});

test('legacy project survives reload, editing, syntax errors and panel changes', async ({ page }) => {
  const source='import manimx as m\nclass Legacy(m.Scene):\n    def construct(self):\n        self.play(m.Create(m.Circle()))\n        self.wait(0.2)\n';
  await page.goto('/');
  await page.evaluate((code)=>{
    localStorage.setItem('arhimed.projects.v1',JSON.stringify([{id:'legacy',title:'Старый проект',code,messages:[],updatedAt:123}]));
    localStorage.setItem('arhimed.active.v1',JSON.stringify('legacy'));
  },source);
  await page.goto('/#/studio');
  const editor=page.locator('textarea.code-area');
  await expect(editor).toHaveValue(source);
  await expect(page.getByText('Подготовка превью',{exact:true})).toBeHidden();
  await expect(page.getByRole('slider')).toHaveAttribute('max','1.2');
  const pause=page.getByRole('button',{name:'Пауза',exact:true}).first();
  if(await pause.isVisible())await pause.click();
  await page.getByRole('slider').fill('0.5');
  await expect(page.getByRole('slider')).toHaveValue('0.5');
  const edited=source.replace('Circle','Square');
  await editor.fill(edited);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(editor).toHaveValue(edited);
  await expect(page.getByText('Подготовка превью', { exact: true })).toBeHidden();
  await editor.fill(edited+'        broken(\n');
  await page.waitForTimeout(500);
  await expect(page.getByText(/Ошибка в строке/)).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await editor.fill(edited);
  await page.waitForTimeout(500);
  await expect(page.getByText(/Ошибка в строке/)).toBeHidden();
  const codePanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Код Manim'})});
  await codePanel.getByRole('button',{name:'Скрыть панель'}).click();
  await page.getByRole('button',{name:'Код Manim', exact:true}).click();
  await expect(editor).toHaveValue(edited);
});

test('real PNG, Python and WebM exports without external network or Python', async ({ page }) => {
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('/#/studio');
  await expect(page.getByText('Подготовка превью',{exact:true})).toBeHidden();
  await page.locator('textarea.code-area').fill('import manimx as m\nclass Export(m.Scene):\n    def construct(self):\n        self.play(m.Create(m.Circle()), run_time=0.2)\n');
  await expect(page.getByRole('slider')).toHaveAttribute('max','0.2');
  for(const [name,ext] of [['Сохранить кадр (PNG)','png'],['Скачать .py','py'],['Скачать видео (WebM)','webm']]){
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name,exact:true}).click();
    const download=await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.'+ext+'$'));
    const data=readFileSync((await download.path())!);
    expect(data.length).toBeGreaterThan(50);
    if(ext==='png') expect(data.subarray(1,4).toString()).toBe('PNG');
    if(ext==='webm') expect(data.subarray(0,4).toString('hex')).toBe('1a45dfa3');
    if(ext==='py') expect(data.toString()).toContain('class Export');
  }
});

test('offline assistant creates a reviewed candidate revision before applying it', async ({page})=>{
  await page.goto('/#/studio');
  await expect(page.getByText('Подготовка превью',{exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Новое видео',exact:true}).click();
  const editor=page.locator('textarea.code-area');
  const before=await editor.inputValue();
  await page.getByPlaceholder('Опишите идею для урока…').fill('Теорема Пифагора');
  await page.getByRole('button',{name:'Отправить',exact:true}).click();
  await expect(page.getByText('Кандидатная ревизия сцены')).toBeVisible({timeout:10000});
  await expect(editor).toHaveValue(before);
  await page.getByRole('button',{name:'Принять кандидатную ревизию'}).click();
  await expect(editor).toHaveValue(/class Pythagoras/);
  await expect(page.getByText(/Ошибка в строке/)).toBeHidden();
  await page.reload();
  await expect(editor).toHaveValue(/class Pythagoras/);
});

test('Stage 2 registry keeps Canvas compatibility and does not persist provider keys', async ({page})=>{
  const legacy='import manimx as m\nclass Legacy(m.Scene):\n    def construct(self):\n        self.wait(0.1)\n';
  await page.goto('/');
  const result=await page.evaluate(async (source)=>{
    // @ts-expect-error Vite source module for browser-only contract test
    const store=await import('/src/lib/store.ts');
    // @ts-expect-error Vite source module for browser-only contract test
    const {studioEngineRegistry}=await import('/src/engines/registry.ts');
    const project=store.normalizeProject({id:'legacy',title:'Legacy',code:source,messages:[],updatedAt:1});
    const canvas=studioEngineRegistry.get('arhimed-canvas');
    const gx=studioEngineRegistry.get('manimgx-browser');
    const probe=await gx?.probe();
    const gxProject=store.setActiveSceneEngine(project,'manimgx-browser');
    const candidate=store.addAiCandidate(project,source.replace('wait(0.1)','wait(0.2)'),project.scenes[0].currentRevision);
    const stale=store.updateSceneSource(candidate.project,source.replace('wait(0.1)','wait(0.3)'));
    return {
      legacyKey:localStorage.getItem('arhimed.projects.v1'),
      project,
      canvas:canvas?.metadata,
      gxAvailable:probe?.ok && probe.value.available,
      gxProject,
      staleAccepted:store.acceptAiCandidate(stale,candidate.candidate.id),
    };
  },legacy);
  expect(result.project.schemaVersion).toBe(2);
  expect(result.project.scenes[0]).toMatchObject({engineId:'arhimed-canvas',dialect:'arhimed-manimx-v1',source:legacy});
  expect(result.project.scenes[0].revisions).toHaveLength(1);
  expect(result.canvas).toMatchObject({engineId:'arhimed-canvas',adapterVersion:'1'});
  expect(result.gxAvailable).toBe(false);
  expect(result.gxProject.scenes).toHaveLength(2);
  expect(result.gxProject.scenes[0]).toMatchObject({engineId:'arhimed-canvas',source:legacy});
  expect(result.gxProject.scenes[1]).toMatchObject({engineId:'manimgx-browser',dialect:'manimgx-0.1.1',source:legacy});
  expect(result.staleAccepted).toBeNull();
  await page.goto('/#/studio');
  await page.getByRole('button',{name:'Настройки ИИ'}).click();
  await page.getByRole('button',{name:'OpenRouter'}).click();
  await page.getByLabel('API-ключ').fill('sk-live-never-persist');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  const serialized=await page.evaluate(()=>JSON.stringify(localStorage));
  expect(serialized).not.toContain('sk-live-never-persist');
});
