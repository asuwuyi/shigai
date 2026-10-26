// Website-only weather credits; Scene authoring previews retain their own labels.
(function(){
  const sources=new Map();let host=null,ownedFooter=null;
  function render(){
    if(!document.body)return;
    const records=[...new Map([...sources.values()].map(item=>[item.config.provider+':'+item.config.attribution,item.config])).values()];
    if(!records.length){host?.remove();host=null;ownedFooter?.remove();ownedFooter=null;return;}
    let footer=[...document.querySelectorAll('[data-site-footer]')].find(node=>getComputedStyle(node).display!=='none');
    if(!footer){
      if(!ownedFooter?.isConnected){ownedFooter=document.createElement('footer');ownedFooter.className='weather-source-footer';document.body.append(ownedFooter);}
      footer=ownedFooter;
    }
    if(!host?.isConnected){host=document.createElement('p');host.className='weather-source-credit';}
    footer.append(host);host.replaceChildren();
    if(ownedFooter&&footer!==ownedFooter){ownedFooter.remove();ownedFooter=null;}
    records.forEach((config,index)=>{
      if(index)host.append(document.createTextNode(' · '));
      const link=document.createElement(config.provider==='open-meteo'?'a':'span');
      if(!index)link.id='sceneWeatherAttribution';
      link.textContent=config.attribution || (config.provider==='open-meteo'?'Weather data by Open-Meteo':'天氣資料');
      if(config.provider==='open-meteo'){link.href='https://open-meteo.com/';link.target='_blank';link.rel='noopener noreferrer';}
      host.append(link);
    });
  }
  function set(key,config){
    if(!config || config.provider==='none'){sources.delete(key);render();return()=>{};}
    const record={config};sources.set(key,record);render();
    return()=>{if(sources.get(key)===record){sources.delete(key);render();}};
  }
  window.ShiGaiWeatherAttribution=Object.freeze({set});
  document.addEventListener('DOMContentLoaded',render,{once:true});
  window.addEventListener('shigai:site-chrome-ready',render);
})();
