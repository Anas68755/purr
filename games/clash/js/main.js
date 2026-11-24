// Game start
// Raids: the first 10 minutes are shielded. While away you may be raided on return (more likely the longer you were gone);
// while playing, a raid is possible about once every ~20 minutes when your shield is down.
{const away=(Date.now()-S.last)/1000;if(away>600&&!(S.sh>Date.now())&&Math.random()<Math.min(.6,.2+away/36000))setTimeout(raid,1500)}
setInterval(()=>{if(!BT&&!(S.sh>now())&&Math.random()<.05)raid()},60000);
setInterval(()=>MU.setMood(BT&&!BT.end?'battle':'home'),500);
tick();setInterval(()=>{tick();if(!BT)save()},250);homeBar();requestAnimationFrame(loop);
$('zi').onclick=()=>zoomC(1.3);$('zo').onclick=()=>zoomC(1/1.3);$('zr').onclick=()=>{VW.z=1;VW.x=VW.y=0;applyView()};
CL.init();
toast('Welcome, Chief! Tap ❗ mines to collect');
