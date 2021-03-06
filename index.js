const fs = require('fs')

//parse tfstate
fs.readFile('terraform.tfstate', 'utf8', (err, data) => {
  if (err) throw err
  
  const terraform = JSON.parse(data)
  const primaryResource = Object.keys(terraform.modules[0].resources)
  const eb = terraform.modules[0].resources[primaryResource].primary
  
  let settings = {
    terraformapp: '${aws_elastic_beanstalk_application.app.name}',
    application: eb.attributes['application'],
    environment: eb.attributes['name'],
    description: eb.attributes['description'],
    solutionStack: eb.attributes['solution_stack_name'],
    attributes: []
  }

  //extract attribute settings 
  for (attribute of Object.keys(eb.attributes)) {
    if (attribute.indexOf('all_settings.') !== -1) {
      let parts = attribute.split('.')
      let match = settings.attributes.find(s => s.id === parts[1])
      if (match) {
        match[parts[2]] = eb.attributes[attribute]
      } 
      else {
        let s = {
          attribute: attribute,
          id: parts[1]
        }
        s[parts[2]] = eb.attributes[attribute]
        settings.attributes.push(s)
      }
    }
  }

  //now generate source code by rendering template
  let output = `# generated by https://github.com/turnerlabs/beanform

provider "aws" {
}

resource "aws_elastic_beanstalk_application" "app" {
  name        = "${settings.application}"
  description = "${settings.description}"
}

resource "aws_elastic_beanstalk_environment" "${settings.environment}" {
  application         = "${settings.terraformapp}"
  name                = "${settings.environment}"  
  solution_stack_name = "${settings.solutionStack}"  
`

  for (let a of settings.attributes.filter(x => x.namespace && x.value !== '')) {
    output += `
  setting {
    namespace = "${a.namespace}"
    name      = "${a.name}"
    value     = "${a.value}"  
  }
`
  }

  output += `
}`

  //write output to main.tf
  fs.writeFile('main.tf', output, err => {
    if (err) throw err;
    console.log('wrote main.tf')
  })

})