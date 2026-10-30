// Old clients get an immediate explanation; no credentials, database or model calls.
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
export function retiredAI(req) {
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
  return Response.json({code:'ai_via_mcp',error:'AI features use your connected MCP agent. Open Connect an agent in Kitchen Studio.',connect_url:'https://kitchenstudio.design/connect/'},{status:410,headers});
}
