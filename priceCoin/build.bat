rmdir /s /q dist
call npx eslint .
call npx tsc -t ES2018 --lib "DOM"
copy package.json dist
copy package-lock.json dist
cd dist
npm install --only=prod
