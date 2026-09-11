import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const {Pool}=pg, app=express();
const port=process.env.PORT||3000, dataDir=process.env.UPLOAD_DIR||'/data/uploads';
fs.mkdirSync(dataDir,{recursive:true});
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:false});
const sessions=new Map();
const upload=multer({storage:multer.diskStorage({destination:dataDir,filename:(r,f,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(5).toString('hex')}${path.extname(f.originalname).toLowerCase()}`)}),limits:{fileSize:8*1024*1024}});
app.use(express.json()); app.use('/uploads',express.static(dataDir)); app.use(express.static('.'));
async function init(){
 await pool.query(`CREATE TABLE IF NOT EXISTS admin_account(id int primary key default 1, username text unique not null, password_hash text not null); CREATE TABLE IF NOT EXISTS menu_items(id serial primary key, category text not null, name text not null, price text not null default '', image_url text, emoji text, sort_order int default 0, created_at timestamptz default now());`);
 const a=await pool.query('select id from admin_account limit 1');
 if(!a.rowCount){const u=process.env.ADMIN_USERNAME||'mamad zamani', p=process.env.ADMIN_PASSWORD; if(!p) console.warn('Set ADMIN_PASSWORD in Railway Variables before first login'); else await pool.query('insert into admin_account(username,password_hash) values($1,$2)',[u,await bcrypt.hash(p,12)]);}
 const count=await pool.query('select count(*)::int as n from menu_items');
 if(!count.rows[0].n && fs.existsSync('menu.html')){
  const html=fs.readFileSync('menu.html','utf8'), sections=[...html.matchAll(/<section class=\"section\" data-cat=\"([^\"]+)\">([\s\S]*?)<\/section>/g)];
  for(const sec of sections){const items=[...sec[2].matchAll(/<div class=\"item\">([\s\S]*?)<\/div><div class=\"item-info\">([\s\S]*?)<\/div><div class=\"price[^>]*>([\s\S]*?)<\/div><\/div>/g)];for(const it of items){const name=(it[2].match(/class=\"name\">([^<]*)/)||[])[1];if(!name)continue;const price=it[3].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();const img=(it[1].match(/src=\"([^\"]+)/)||[])[1]||null;const emoji=(it[1].match(/class=\"emoji\">([^<]*)/)||[])[1]||'☕';await pool.query('insert into menu_items(category,name,price,image_url,emoji) values($1,$2,$3,$4,$5)',[sec[1],name,price,img,emoji]);}}
 }
}
function auth(req,res,next){const sid=req.headers.authorization?.replace('Bearer ','')||req.cookies?.sid;if(!sid||!sessions.has(sid))return res.status(401).json({error:'unauthorized'});req.user=sessions.get(sid);next()}
app.post('/api/login',async(req,res)=>{const {username,password}=req.body||{};const r=await pool.query('select * from admin_account limit 1');if(!r.rowCount||r.rows[0].username!==username||!(await bcrypt.compare(password||'',r.rows[0].password_hash)))return res.status(401).json({error:'نام کاربری یا رمز عبور نادرست است'});const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{username});res.json({token:sid});});
app.post('/api/logout',auth,(req,res)=>{sessions.delete(req.headers.authorization?.replace('Bearer ',''));res.json({ok:true})});
app.get('/api/menu',async(req,res)=>res.json((await pool.query('select * from menu_items order by category,sort_order,id')).rows));
app.post('/api/items',auth,upload.single('image'),async(req,res)=>{const {category,name,price,emoji}=req.body;const image_url=req.file?`/uploads/${req.file.filename}`:req.body.image_url||null;const r=await pool.query('insert into menu_items(category,name,price,image_url,emoji) values($1,$2,$3,$4,$5) returning *',[category,name,price||'',image_url,emoji||'☕']);res.json(r.rows[0]);});
app.put('/api/items/:id',auth,upload.single('image'),async(req,res)=>{const old=(await pool.query('select * from menu_items where id=$1',[req.params.id])).rows[0];if(!old)return res.sendStatus(404);const image_url=req.file?`/uploads/${req.file.filename}`:req.body.image_url??old.image_url;const r=await pool.query('update menu_items set category=$1,name=$2,price=$3,image_url=$4,emoji=$5 where id=$6 returning *',[req.body.category,req.body.name,req.body.price||'',image_url,req.body.emoji||old.emoji,req.params.id]);if(req.file&&old.image_url?.startsWith('/uploads/'))fs.rm(path.join(dataDir,path.basename(old.image_url)),()=>{});res.json(r.rows[0]);});
app.delete('/api/items/:id',auth,async(req,res)=>{const old=(await pool.query('delete from menu_items where id=$1 returning *',[req.params.id])).rows[0];if(old?.image_url?.startsWith('/uploads/'))fs.rm(path.join(dataDir,path.basename(old.image_url)),()=>{});res.json({ok:true});});
app.put('/api/account',auth,async(req,res)=>{const {username,currentPassword,newPassword}=req.body;const a=(await pool.query('select * from admin_account limit 1')).rows[0];if(!(await bcrypt.compare(currentPassword||'',a.password_hash)))return res.status(400).json({error:'رمز فعلی نادرست است'});await pool.query('update admin_account set username=$1,password_hash=$2 where id=$3',[username||a.username,await bcrypt.hash(newPassword,12),a.id]);sessions.clear();res.json({ok:true});});
app.get('/admin',(_,res)=>res.sendFile(path.resolve('admin.html')));
init().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`EVAN admin server on ${port}`))).catch(e=>{console.error(e);process.exit(1)});
