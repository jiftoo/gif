npm run build && ^
git add . && ^
git commit -m "New deploy" && ^
git push && ^
git checkout master && ^ 
git subtree split --prefix dist -b gh-pages
git push -f origin gh-pages:gh-pages
git branch -D gh-pages
