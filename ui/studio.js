(() => {
  function update() {
    const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
    const page=location.pathname.split('/').pop();
    const step=['startup','files','guide'].includes(page)?null:(document.body.dataset.readingStep||hash.get('step')||query.get('step'));
    const learning=document.body.classList?.contains('learning-page');
    const view=learning?'learn':'explore';
    document.querySelectorAll('.studio-nav [data-view]').forEach(a=>{
      if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      const target=new URL(a.href,location.href),params=new URLSearchParams(target.hash.slice(1));
      if(!params.has('lens'))return;
      if(step)params.set('step',step);else params.delete('step');
      target.hash=params.toString();a.href=target.pathname+target.search+target.hash;
    });
    if(globalThis.LearningStudio){
      document.querySelectorAll('[data-learning-profile]').forEach(s=>s.value=LearningStudio.profile());
      const last=LearningStudio.readState().last;
      document.querySelectorAll('[data-learning-return]').forEach(a=>{a.hidden=!!learning;if(last){a.href=LearningStudio.lessonUrl(last);a.textContent='読んでいた学習へ戻る';}else{a.href=document.body.dataset.studio==='local'?'/':'index.html';a.textContent='学習の入口へ戻る';}});
    }
  }
  document.querySelectorAll('[data-learning-profile]').forEach(select=>{
    select.addEventListener?.('change',()=>{globalThis.LearningStudio?.setProfile(select.value);update();});
  });
  addEventListener('hashchange',update);
  document.addEventListener('reading-context-change',update);
  document.addEventListener('learning-profile-change',update);
  update();
})();
