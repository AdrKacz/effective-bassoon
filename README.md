## How to host localy from your domain
Google authentication and other providers don't always serve credentials and claims to `localhost`.

So, in order to reproduce production as close as possible even when running the local development website, we'll configure our **local DNS** to redirect `local.le-studio-k.fr` to `localhost`.

Update `/etc/hosts`:
```sh
sudo sh -c "cat << EOF >> /etc/hosts
# Added for Effective Bassoon
127.0.0.1 local.le-studio-k.fr
# End of section
EOF"
```

Then kil the current **DNS** process and restart it to take your latest change into account:
```
sudo killall -HUP mDNSResponder
```

That being done, we also want to accept traffic from **HTTPS** so providers will consider our local endpoint secure.
In [`vite.config.ts`](./vite.config.ts) we configured our local run to serve traffic from **443** *(we using the default HTTPS port to simplify redirects)*.

Your browser might not like it and will rightfully complain: you don't *really* own this domain (*you can do this for any domain*). To please it, we'll create a **local certificate** with **mkcert**.
Open your home folder, *or anything safe, just don't do it in the Git repository as you don't want to commit the certificate*, and run:
```sh
brew install mkcert
brew install nss
mkcert -install
mkcert local.le-studio-k.fr
```

When you're done working on this project, run `mkcert -uninstall` to delete this certificate.

You can now **restart Firefox** to start using you brand new certificate. You can run `npm run dev` and you should see your website on [https://local.le-studio-k.fr](https://local.le-studio-k.fr).

## Side tools
- Remove backgrounds with https://www.remove.bg
- Set up cookie banner https://playground.cookieconsent.orestbida.com/ (check https://github.com/orestbida/cookieconsent/discussions/523#discussioncomment-8645730)
- To patch use, for example, `npm run patch @openauthjs/openauth`
- Edit mail as HTML: https://stackoverflow.com/questions/48214386/insert-html-into-email-in-apple-mail

## TODO
Send email with invoice and link to manage subscription
Cancel on payment cancelled

## Generate a transparent pixel

1. `brew install imagemagick`
2. `magick -size 1x1 xc:none transparent.png`
3. `base64 -i transparent.png`