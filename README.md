<h1 align="center">code-picker</h1>

<p align="center">
Extract the component code needed from the component library and add it to your local project.
</p>

<p align="center">
<a href="https://www.npmjs.com/package/code-picker"><img src="https://img.shields.io/npm/v/code-picker?color=a1b858&label=" alt="NPM version"></a></p>

## how use

#### Pull all the files in the directory
- nr start --repo https://github.com/element-plus/element-plus/tree/dev/packages/components/alert --out ./examples

- log
```text
Create file -> /Desktop/code-picker/examples/alert/index.ts
Create file -> /Desktop/code-picker/examples/alert/src/alert.ts
Create file -> /Desktop/code-picker/examples/alert/__tests__/alert.test.tsx
Create file -> /Desktop/code-picker/examples/alert/src/instance.ts
Create file -> /Desktop/code-picker/examples/alert/style/css.ts
Create file -> /Desktop/code-picker/examples/alert/style/index.ts
Create file -> /Desktop/code-picker/examples/alert/src/alert.vue
```

#### Pull out the specified file and the import file included in the code
- nr start --repo https://github.com/element-plus/element-plus/tree/dev/packages/components/form/index.ts --out ./examples

## get your github access tokens

- The primary rate limit for unauthenticated requests is 60 requests per hour.

https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

##
